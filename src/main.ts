import "./style.css";

const dropZone = document.getElementById("drop-zone")! as HTMLDivElement;
const fileInput = document.getElementById("file-input")! as HTMLInputElement;

dropZone.addEventListener("drop", drop);
fileInput.addEventListener("change", onFileInputChange);

async function drop(event: DragEvent) {
  event.stopPropagation();
  event.preventDefault();

  const items: DataTransferItem[] = Array.from(event.dataTransfer?.items || []);
  console.log("DataTransferItems", items);

  const { files } = await dropItemsToFilesAndFolders(items);
  console.log("files", files);
}

function onFileInputChange(event: Event) {
  const target = event.target as HTMLInputElement;
  // If input element has the `webkitdirectory` attribute set,
  // `files` array will contain files from the whole directory tree.
  const files = Array.from(target.files || []);
  console.log("file input files:", files);
}

export async function dropItemsToFilesAndFolders(
  items: DataTransferItem[]
): Promise<{ files: FileWithPath[]; folders: FolderWithDepth[] }> {
  const fsEntries = getFileSystemEntries(items);
  const filesWithPath: FileWithPath[] = [];

  const { files, folders } = await getFilesAndFolders(fsEntries);
  for await (const f of files) {
    filesWithPath.push(f);
  }

  return {
    files: filesWithPath,
    folders,
  };
}

type FileWithPath = {
  file: File;
  path: string;
};

type FolderWithDepth = {
  depth: number;
  path: string;
};

function notEmpty<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function getFileSystemEntries(items: DataTransferItem[]): FileSystemEntry[] {
  return items
    .filter((item) => item.kind === "file")
    .map((item) => {
      // For rationale: https://developer.mozilla.org/en-US/docs/Web/API/DataTransferItem/webkitGetAsEntry
      const entry: FileSystemEntry | null =
        item.webkitGetAsEntry?.() || (item as any).getAsEntry?.();
      if (!entry) {
        console.error("Could not fetch FileSystemEntry for item:", item);
      }
      return entry;
    })
    .filter(notEmpty);
}

function isFileEntry(entry: FileSystemEntry): entry is FileSystemFileEntry {
  return entry.isFile;
}

function isDirectoryEntry(
  entry: FileSystemEntry
): entry is FileSystemDirectoryEntry {
  return entry.isDirectory;
}

type GetFileSystemEntryItemsResult = {
  files: Promise<FileWithPath>[];
  folders: FolderWithDepth[];
};

/**
 * Scans root-level file system entries from the `drop` the event for files and folders.
 * @param entry The `FileSystemEntry` objects to use to do the scan.
 * @param maxDepth The maximum folder nesting level, 0-based.
 */
async function getFilesAndFolders(
  entries: FileSystemEntry[],
  maxDepth = Number.MAX_SAFE_INTEGER
): Promise<GetFileSystemEntryItemsResult> {
  const result: GetFileSystemEntryItemsResult = { files: [], folders: [] };
  // Traversing the folder tree breadth first allows us to add folders to the `result.folders`
  // in the order they have to be created later.
  let depth = 0;
  const queue = [...entries];
  while (queue.length) {
    if (depth > maxDepth) break;
    for (let levelSize = queue.length; levelSize > 0; levelSize -= 1) {
      const entry = queue.shift()!;
      if (isDirectoryEntry(entry)) {
        result.folders.push({ depth, path: entry.fullPath });
        const directoryReader = entry.createReader();
        const directoryEntries = await new Promise<FileSystemEntry[]>(
          (resolve, reject) => {
            directoryReader.readEntries(
              (entries) => resolve(entries),
              (error) => reject(error)
            );
          }
        );
        queue.push(...directoryEntries);
      } else if (isFileEntry(entry)) {
        const file = new Promise<FileWithPath>((resolve, reject) => {
          entry.file(
            (file) => {
              resolve({
                file,
                // `file.webkitRelativePath` is empty in Chrome, so getting it from the entry instead
                // and keeping track of it separately (rather than mutating the file)
                path: entry.fullPath,
              });
            },
            (error) => reject(error)
          );
        });
        result.files.push(file);
      }
    }
    depth += 1;
  }
  return result;
}

// https://docs.cypress.io/api/commands/selectfile#Syntax
describe("Home Page", () => {
  it("successfully loads", () => {
    cy.visit("http://localhost:5173/");

    // cy.get("#file-input").selectFile({
    //   contents: Cypress.Buffer.from("file contents"),
    //   fileName: "file.txt",
    //   mimeType: "text/plain",
    //   lastModified: Date.now(),
    // });
    // cy.get("#file-input").selectFile("index.html");

    cy.get("#drop-zone").selectFile(["index.html", "package.json"], {
      action: "drag-drop",
    });
  });
});

// describe("My First Test", () => {
//   it("Does not do much!", () => {
//     expect(true).to.equal(true);
//   });
// });

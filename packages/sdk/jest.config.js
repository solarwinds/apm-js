const path = require("node:path")

module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  setupFilesAfterEnv: [
    "jest-extended/all",
    path.join(__dirname, "..", "..", "scripts", "env.js"),
  ],
}

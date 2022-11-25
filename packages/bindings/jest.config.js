const path = require("node:path")

module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  setupFiles: [path.join(__dirname, "..", "..", "scripts", "env.js")],
}

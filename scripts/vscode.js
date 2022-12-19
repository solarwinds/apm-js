const fs = require("node:fs")

const extensions = fs.readFileSync("./.vscode/extensions.json", {
  encoding: "utf8",
})
const extensionsJson = JSON.parse(extensions)

const settings = fs.readFileSync("./.vscode/settings.json", {
  encoding: "utf8",
})
const settingsJson = JSON.parse(settings)

const recommendations = ["xaver.clang-format"]
for (const recommendation of recommendations) {
  if (!extensionsJson["recommendations"].includes(recommendation)) {
    extensionsJson["recommendations"].push(recommendation)
  }
}

if (!settingsJson["eslint.experimental.useFlatConfig"]) {
  settingsJson["eslint.experimental.useFlatConfig"] = true
}

const updatedExtensions = JSON.stringify(extensionsJson, null, 2)
fs.writeFileSync("./.vscode/extensions.json", updatedExtensions)

const updatedSettings = JSON.stringify(settingsJson, null, 2)
fs.writeFileSync("./.vscode/settings.json", updatedSettings)

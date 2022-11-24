const fs = require("node:fs")

const extensions = fs.readFileSync("./.vscode/extensions.json", {
  encoding: "utf8",
})

const extensionsJson = JSON.parse(extensions)
const recommendations = ["xaver.clang-format"]
for (const recommendation of recommendations) {
  if (!extensionsJson["recommendations"].includes(recommendation)) {
    extensionsJson["recommendations"].push(recommendation)
  }
}

const updatedExtensions = JSON.stringify(extensionsJson, null, 2)
fs.writeFileSync("./.vscode/extensions.json", updatedExtensions)

/*
Copyright 2023 SolarWinds Worldwide, LLC.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

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
const eslintWorkingDirectories = ["packages/*", "examples", "scripts"]
settingsJson["eslint.workingDirectories"] ??= eslintWorkingDirectories
for (const ewd of eslintWorkingDirectories) {
  if (!settingsJson["eslint.workingDirectories"].includes(ewd)) {
    settingsJson["eslint.workingDirectories"].push(ewd)
  }
}

const updatedExtensions = JSON.stringify(extensionsJson, null, 2)
fs.writeFileSync("./.vscode/extensions.json", updatedExtensions)

const updatedSettings = JSON.stringify(settingsJson, null, 2)
fs.writeFileSync("./.vscode/settings.json", updatedSettings)

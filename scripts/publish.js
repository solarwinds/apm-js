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

const process = require("node:process")
const cproc = require("node:child_process")
const fs = require("node:fs")

const { name, version } = JSON.parse(
  fs.readFileSync("package.json", { encoding: "utf-8" }),
)

let publishedVersions
try {
  const info = JSON.parse(
    cproc
      .execSync(`yarn npm info ${name} --json --fields versions`)
      .toString("utf-8"),
  )
  publishedVersions = info.versions
} catch {
  publishedVersions = []
}

if (publishedVersions.includes(version)) {
  console.log(`${name}@${version} is already published`)
  process.exit()
}

let command = "yarn npm publish"
if (version.includes("pre")) {
  command += " --tag prerelease"
}

console.log(`$ ${command}`)
cproc.execSync(command, { stdio: "inherit" })

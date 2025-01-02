/*
Copyright 2023-2025 SolarWinds Worldwide, LLC.

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

function exec(cmd, opts = {}) {
  console.log(`$ ${cmd}`)
  return cproc.execSync(cmd, { stdio: "inherit", ...opts })
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, { encoding: "utf-8" }))
}

function writeJson(path, data) {
  fs.writeFileSync(path, JSON.stringify(data))
  exec(`prettier --write '${path}'`)
}

function gitStatus() {
  const output = exec("git status --porcelain", { stdio: "pipe" }).toString(
    "utf-8",
  )
  const files = output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [mode, ...file] = line.split(" ")
      return { mode: mode.trim(), file: file.join(" ").trim() }
    })
  return files
}

const status = gitStatus()
if (status.length > 0) {
  throw new Error("commit all changes before bumping versions", {
    cause: status,
  })
}

let command = "yarn version apply --all"
if (process.argv[2] === "pre") {
  command += " --prerelease='pre.%n'"
}

exec(command)
exec("prettier --write 'packages/*/package.json'")

const bindingsVersion = readJson("packages/bindings/package.json", {
  encoding: "utf-8",
}).version
const bindingsNative = fs.readdirSync("packages/bindings/npm")
for (const n of bindingsNative) {
  const nPackagePath = `packages/bindings/npm/${n}/package.json`
  const nPackage = readJson(nPackagePath)

  console.log(`${n} ${nPackage.version} -> ${bindingsVersion}`)
  nPackage.version = bindingsVersion
  writeJson(nPackagePath, nPackage)
}

exec("git add yarn.lock .yarn 'packages/**/package.json'")

const bumped = gitStatus()
  .filter(({ file }) => /packages\/[^/]+\/package.json/.test(file))
  .map(({ file }) => readJson(file))

const commitMessage = bumped
  .map(({ name, version }) => `${name} ${version}`)
  .sort()
  .join(", ")
exec(`git commit -m 'version bump' -m '${commitMessage}'`)

for (const { name, version } of bumped) {
  const tag =
    name === "solarwinds-apm"
      ? `v${version}`
      : `${name.replace("@solarwinds-apm/", "")}-v${version}`
  const message = `${name} ${version}`
  exec(`git tag -a '${tag}' -m '${message}'`)
}

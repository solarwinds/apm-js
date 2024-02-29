/*
Copyright 2023-2024 SolarWinds Worldwide, LLC.

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

const { execSync } = require("node:child_process")
const {
  cpSync,
  createWriteStream,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} = require("node:fs")
const { argv } = require("node:process")
const archiver = require("archiver")
const ora = require("ora")

const [name, version] = argv.slice(2)

const rm = (...args) => {
  try {
    rmSync(...args)
  } catch {
    // ignore
  }
}

const replace = (file) => {
  let contents = readFileSync(file, { encoding: "utf-8" })
  contents = contents
    .replaceAll("{{name}}", name)
    .replaceAll("{{version}}", version)
  writeFileSync(file, contents)
}

rm("lambda/layer.zip")
rm("node_modules/.lambda", { recursive: true })
cpSync("lambda", "node_modules/.lambda", { recursive: true })
replace("node_modules/.lambda/package.json")
replace("node_modules/.lambda/shim.cjs")
replace("node_modules/.lambda/shim.mjs")

execSync("touch yarn.lock && yarn install", {
  cwd: "node_modules/.lambda",
  env: { ...process.env, NODE_ENV: "production" },
  stdio: "inherit",
})

const scope = `node_modules/.lambda/node_modules/${
  name === "solarwinds-apm" ? "@solarwinds-apm" : "@solarwinds"
}`
for (const entry of readdirSync(scope)) {
  if (entry.includes("bindings-") && !entry.includes("serverless")) {
    rmSync(`${scope}/${entry}`, { recursive: true })
  }
}

const spinner = ora("building layer")

const archive = archiver("zip", { zlib: { level: 9 } })
archive
  .on("error", (err) => {
    spinner.fail(err.message)
    throw err
  })
  .on("warning", (warn) => {
    spinner.fail(warn.message)
    throw warn
  })
  .on("entry", (e) => {
    spinner.text = e.name
    spinner.render()
  })

const out = createWriteStream("lambda/layer.zip")
out.on("error", (err) => {
  spinner.fail(err.message)
  throw err
})
archive.pipe(out)

archive.directory(
  "node_modules/.lambda/node_modules/",
  "solarwinds-apm/node_modules/",
)
archive.file("node_modules/.lambda/shim.cjs", {
  name: "solarwinds-apm/shim.cjs",
})
archive.file("node_modules/.lambda/shim.mjs", {
  name: "solarwinds-apm/shim.mjs",
})
archive.file("node_modules/.lambda/wrapper", {
  name: "solarwinds-apm/wrapper",
  mode: 0o755,
})

archive.finalize().then(() => spinner.succeed("layer built"))

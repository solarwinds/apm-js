/*
Copyright 2023-2026 SolarWinds Worldwide, LLC.

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

import { execSync } from "node:child_process"
import {
  createWriteStream,
  mkdirSync,
  readdirSync,
  readFileSync,
} from "node:fs"
import { userInfo } from "node:os"
import path from "node:path"

import archiver from "archiver"
import ora from "ora"

const root = path.dirname(import.meta.dirname)
const dir = path.join(root, "scan")
mkdirSync(dir, { recursive: true })

if (process.cwd() === root) {
  // We're running in the project root which means we can pack and submit
  const user = userInfo()
  const { version } = JSON.parse(
    readFileSync("packages/solarwinds-apm/package.json", {
      encoding: "utf-8",
    }),
  )

  const spinner = ora("zipping packages")

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

  const out = createWriteStream(path.join(dir, "solarwinds-apm.zip"))
  out.on("error", (err) => {
    spinner.fail(err.message)
    throw err
  })

  archive.pipe(out)
  for (const file of readdirSync(dir)) {
    if (file === "solarwinds-apm.zip") {
      continue
    }

    // Add every package tarball
    archive.file(path.join(dir, file), {
      name: `solarwinds-apm/${version}/${file}`,
    })
  }
  // Add the lambda layer
  archive.file(path.join(root, "lambda", "layer.zip"), {
    name: `solarwinds-apm/${version}/lambda.zip`,
  })

  const command = [
    "docker run --rm",
    `-u ${user.uid}:${user.gid}`,
    `-v ${dir}:/packages`,
    `-e RLPORTAL_ACCESS_TOKEN=${process.env.RLPORTAL_ACCESS_TOKEN}`,
    "reversinglabs/rl-scanner-cloud rl-scan",
    "--rl-portal-server solarwinds",
    "--rl-portal-org SolarWinds",
    "--rl-portal-group SaaS-Agents-SWO",
    `--purl apm-js/solarwinds-apm@${version}`,
    `--file-path /packages/solarwinds-apm.zip`,
    "--submit-only",
    "--replace",
  ]
  await archive.finalize()
  spinner.succeed("zipped")
  // Submit everything once it's zipped
  execSync(command.join(" "), { stdio: "inherit" })
} else {
  // We're running in a package directory, download our tarball from npm
  const { name, version } = JSON.parse(
    readFileSync("package.json", {
      encoding: "utf-8",
    }),
  )
  execSync(`npm pack ${name}@${version} --pack-destination ${dir}`, {
    stdio: "inherit",
  })
}

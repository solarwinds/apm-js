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

const fs = require("node:fs").promises
const path = require("node:path")
const crypto = require("node:crypto")
const axios = require("axios")

const root =
  "https://ssp-prod-global-agent-binaries.s3.amazonaws.com/apm/c-lib/latest/"
const libs = [
  "liboboe-1.0-aarch64.so",
  "liboboe-1.0-alpine-aarch64.so",
  "liboboe-1.0-x86_64.so",
  "liboboe-1.0-alpine-x86_64.so",
]
const files = [
  "VERSION",
  "include/oboe.h",
  "include/oboe_api.h",
  "include/oboe_api.cpp",
  "include/oboe_debug.h",
  "include/bson/bson.h",
  "include/bson/platform_hacks.h",
]

const oboePath = path.join(
  path.dirname(__dirname),
  "packages",
  "bindings",
  "oboe",
)

async function downloadLib(lib) {
  const soUrl = `${root}${lib}`
  const so = await axios.get(soUrl, { responseType: "arraybuffer" })

  const checksumUrl = `${soUrl}.sha256`
  const checksum = await axios.get(checksumUrl, { responseType: "text" })

  const realChecksum = crypto.createHash("sha256").update(so.data).digest("hex")

  if (checksum.data.trim() !== realChecksum) {
    throw new Error(`invalid checksum for "${lib}"`)
  }

  const soPath = path.join(oboePath, lib)
  await fs.mkdir(path.dirname(soPath), { recursive: true })
  await fs.writeFile(soPath, so.data)
  await fs.writeFile(`${soPath}.sha256`, checksum.data)
}

async function downloadFile(file) {
  const url = `${root}${file}`
  const res = await axios.get(url, { responseType: "text" })

  const filePath = path.join(oboePath, file)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, res.data)
}

Promise.all([...libs.map(downloadLib), ...files.map(downloadFile)]).catch(
  console.error,
)

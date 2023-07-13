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

const http = require("node:https")
const fs = require("node:fs/promises")
const path = require("node:path")
const crypto = require("node:crypto")

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

const oboePath = path.join(__dirname, "oboe")

const get = (url) =>
  new Promise((res, rej) =>
    http.get(url, (response) => {
      const result = { headers: response.headers, status: response.statusCode }
      if (result.status !== 200) {
        return rej(result)
      }

      result.data = Buffer.alloc(0)
      response.on(
        "data",
        (chunk) => (result.data = Buffer.concat([result.data, chunk])),
      )

      response.on("end", () => res(result))
    }),
  )

async function downloadLib(lib) {
  console.log(`download ${lib}`)

  const soUrl = `${root}${lib}`
  const so = await get(soUrl)

  const checksumUrl = `${soUrl}.sha256`
  const checksum = await get(checksumUrl)

  console.log(`checksum ${lib}`)
  const realChecksum = crypto.createHash("sha256").update(so.data).digest("hex")

  if (checksum.data.toString("utf-8").trim() !== realChecksum) {
    throw new Error(`invalid checksum for "${lib}"`)
  }

  const soPath = path.join(oboePath, lib)
  const checksumPath = `${soPath}.sha256`

  await fs.mkdir(path.dirname(soPath), { recursive: true })
  await fs.writeFile(soPath, so.data)
  await fs.writeFile(checksumPath, checksum.data)
}

async function downloadFile(file) {
  console.log(`download ${file}`)

  const url = `${root}${file}`
  const res = await get(url)

  const filePath = path.join(oboePath, file)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, res.data)
}

Promise.all([...libs.map(downloadLib), ...files.map(downloadFile)]).catch(
  console.error,
)

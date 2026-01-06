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

import { randomUUID } from "node:crypto"
import fs from "node:fs/promises"
import http from "node:http"
import path from "node:path"
import process from "node:process"

import { detectResources } from "@opentelemetry/resources"
import { afterEach, describe, expect, it } from "@solarwinds-apm/test"

import { uamsDetector } from "../src/resource-detector-uams.js"

const FILE_ID = randomUUID()
const API_ID = randomUUID()

const FILE =
  process.platform === "win32"
    ? "C:\\ProgramData\\SolarWinds\\UAMSClient\\uamsclientid"
    : "/opt/solarwinds/uamsclient/var/uamsclientid"

const file = () =>
  fs
    .mkdir(path.dirname(FILE), { recursive: true })
    .then(() => fs.writeFile(FILE, FILE_ID))

let server: http.Server | undefined = undefined
const api = (real: boolean) =>
  new Promise<void>((resolve) => {
    server = http.createServer((req, res) => {
      if (real) {
        if (req.url === "/info/uamsclient") {
          res.end(JSON.stringify({ uamsclient_id: API_ID }))
        } else {
          res.statusCode = 404
          res.end()
        }
      } else {
        res.end("Hello there !")
      }
    })
    server.listen(2113, resolve)
  })

describe("uamsDetector", () => {
  afterEach(() => fs.rm(FILE, { force: true }))
  afterEach((done) => {
    if (server) {
      server.close(() => {
        server = undefined
        done()
      })
    } else {
      done()
    }
  })

  it("detects id from file when file present and api running", async () => {
    await file()
    await api(true)

    const resource = detectResources({ detectors: [uamsDetector] })
    await resource.waitForAsyncAttributes?.()

    expect(resource.attributes).to.deep.equal({
      "sw.uams.client.id": FILE_ID,
      "host.id": FILE_ID,
    })
  })

  it("detects id from file when file present and api not running", async () => {
    await file()

    const resource = detectResources({ detectors: [uamsDetector] })
    await resource.waitForAsyncAttributes?.()

    expect(resource.attributes).to.deep.equal({
      "sw.uams.client.id": FILE_ID,
      "host.id": FILE_ID,
    })
  })

  it("detects id from file when file present and unrelated running", async () => {
    await file()
    await api(false)

    const resource = detectResources({ detectors: [uamsDetector] })
    await resource.waitForAsyncAttributes?.()

    expect(resource.attributes).to.deep.equal({
      "sw.uams.client.id": FILE_ID,
      "host.id": FILE_ID,
    })
  })

  it("detects id from api when file not present and api running", async () => {
    await api(true)

    const resource = detectResources({ detectors: [uamsDetector] })
    await resource.waitForAsyncAttributes?.()

    expect(resource.attributes).to.deep.equal({
      "sw.uams.client.id": API_ID,
      "host.id": API_ID,
    })
  })

  it("detects nothing when file not present and api not running", async () => {
    const resource = detectResources({ detectors: [uamsDetector] })
    await resource.waitForAsyncAttributes?.()

    expect(resource.attributes).to.deep.equal({})
  })

  it("detects nothing when file not present and unrelated running", async () => {
    await api(false)

    const resource = detectResources({ detectors: [uamsDetector] })
    await resource.waitForAsyncAttributes?.()

    expect(resource.attributes).to.deep.equal({})
  })
})

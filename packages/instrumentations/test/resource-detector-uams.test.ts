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

import { randomUUID } from "node:crypto"
import http from "node:http"

import { describe, expect, it } from "@solarwinds-apm/test"

import { uamsDetector } from "../src/resource-detector-uams.js"

describe("uamsDetector", () => {
  describe("client running", () => {
    let server: http.Server
    const id = randomUUID()

    before((done) => {
      server = http.createServer((req, res) => {
        if (req.url === "/info/uamsclient") {
          res.end(JSON.stringify({ uamsclient_id: id }))
        } else {
          res.statusCode = 404
          res.end()
        }
      })
      server.listen(2113, "127.0.0.1", done)
    })

    after((done) => {
      server.close(done)
    })

    it("detects client id", async () => {
      const resource = uamsDetector.detect()
      await resource.waitForAsyncAttributes?.()

      expect(resource.attributes).to.deep.equal({
        "sw.uams.client.id": id,
      })
    })
  })

  describe("client not running", () => {
    it("detects nothing", async () => {
      const resource = uamsDetector.detect()
      await resource.waitForAsyncAttributes?.()

      expect(resource.attributes).to.deep.equal({})
    })
  })

  describe("unrelated service running", () => {
    let server: http.Server

    before((done) => {
      server = http.createServer((_req, res) => {
        res.end("Hello there !")
      })
      server.listen(2113, "127.0.0.1", done)
    })

    after((done) => {
      server.close(done)
    })

    it("detects nothing", async () => {
      const resource = uamsDetector.detect()
      await resource.waitForAsyncAttributes?.()

      expect(resource.attributes).to.deep.equal({})
    })
  })
})

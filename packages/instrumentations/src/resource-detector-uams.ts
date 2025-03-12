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

import fs from "node:fs/promises"
import http from "node:http"
import process from "node:process"

import { type Attributes, context, diag } from "@opentelemetry/api"
import { suppressTracing } from "@opentelemetry/core"
import { type DetectorSync, Resource } from "@opentelemetry/resources"
import { ATTR_HOST_ID } from "@opentelemetry/semantic-conventions/incubating"

export const ATTR_UAMS_CLIENT_ID = "sw.uams.client.id"

const UAMS_CLIENT_PATH =
  process.platform === "win32"
    ? "C:\\ProgramData\\SolarWinds\\UAMSClient\\uamsclientid"
    : "/opt/solarwinds/uamsclient/var/uamsclientid"

const UAMS_CLIENT_URL = new URL("http://127.0.0.1:2113/info/uamsclient")
const UAMS_CLIENT_ID_FIELD = "uamsclient_id"

class UamsDetector implements DetectorSync {
  readonly #logger = diag.createComponentLogger({
    namespace: `@solarwinds-apm/instrumentations/${UamsDetector.name}`,
  })

  detect(): Resource {
    return new Resource(
      {},
      context.with(suppressTracing(context.active()), () =>
        this.#readFromFile()
          .catch(() => this.#readFromApi())
          .catch(() => ({})),
      ),
    )
  }

  async #readFromFile(): Promise<Attributes> {
    try {
      let id = await fs.readFile(UAMS_CLIENT_PATH, { encoding: "utf-8" })
      id = id.trim()

      return {
        [ATTR_UAMS_CLIENT_ID]: id,
        [ATTR_HOST_ID]: id,
      }
    } catch (error) {
      this.#logger.debug("file error", error)
      throw error
    }
  }

  #readFromApi() {
    return new Promise<Attributes>((resolve, reject) => {
      let json = ""
      http
        .get(UAMS_CLIENT_URL, { timeout: 1000 }, (res) =>
          res
            .setEncoding("utf-8")
            .on("data", (data: string) => (json += data))
            .on("end", () => {
              try {
                const data: unknown = JSON.parse(json)
                if (
                  typeof data !== "object" ||
                  data === null ||
                  !(UAMS_CLIENT_ID_FIELD in data) ||
                  typeof data[UAMS_CLIENT_ID_FIELD] !== "string"
                ) {
                  throw new Error("Invalid response format")
                }

                const id = data[UAMS_CLIENT_ID_FIELD]
                resolve({
                  [ATTR_UAMS_CLIENT_ID]: id,
                  [ATTR_HOST_ID]: id,
                })
              } catch (error) {
                this.#logger.debug("api response error", error)
                // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
                reject(error)
              }
            })
            .on("error", (error) => {
              this.#logger.debug("api response error", error)
              reject(error)
            }),
        )
        .on("error", (error) => {
          this.#logger.debug("api request error", error)
          reject(error)
        })
    })
  }
}

export const uamsDetector: DetectorSync = new UamsDetector()

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

import { describe, expect, it } from "@solarwinds-apm/test"

import { exporterConfig } from "../../src/exporters/config.js"
import { type Configuration } from "../../src/shared/config.js"

const SIGNALS = ["traces", "metrics", "logs"] as const
const ENVS = ["cloud", "stage", "dev"]

describe(exporterConfig.name, () => {
  describe("swo endpoints", () => {
    for (const signal of SIGNALS) {
      for (const env of ENVS) {
        it(`returns the proper ${signal} config for ${env}`, () => {
          const url = `https://otel.collector.na-01.${env}.solarwinds.com/v1/${signal}`
          const config = {
            token: "token",
            otlp: { [signal]: url },
          } as Configuration

          expect(exporterConfig(config, signal)).to.loosely.deep.equal({
            url,
            headers: { authorization: "Bearer token" },
            compression: "gzip",
            httpAgentOptions: {},
          })
        })
      }
    }
  })

  describe("custom endpoints", () => {
    for (const signal of SIGNALS) {
      it(`returns the proper ${signal} config`, () => {
        const url = `https://localhost:4318/v1/${signal}`
        const config = {
          token: "token",
          otlp: { [signal]: url },
          trustedpath: "certificate",
        } as Configuration & { trustedpath?: string }

        expect(exporterConfig(config, signal)).to.loosely.deep.equal({
          url,
          headers: {},
          compression: "gzip",
          httpAgentOptions: { ca: "certificate" },
        })
      })
    }
  })

  describe("invalid endpoints", () => {
    for (const signal of SIGNALS) {
      it(`returns the proper ${signal} config`, () => {
        const url = "invalid"
        const config = {
          token: "token",
          otlp: { [signal]: url },
          trustedpath: "certificate",
        } as Configuration & { trustedpath?: string }

        expect(exporterConfig(config, signal)).to.loosely.deep.equal({
          url,
          headers: {},
          compression: "gzip",
          httpAgentOptions: { ca: "certificate" },
        })
      })
    }
  })
})

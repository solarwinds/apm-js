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

import { DiagLogLevel } from "@opentelemetry/api"
import { oboe } from "@solarwinds-apm/bindings"
import { beforeEach, describe, expect, it } from "@solarwinds-apm/test"

import aoCert from "../src/appoptics.crt"
import { type ExtendedSwConfiguration, readConfig } from "../src/config"

describe("readConfig", () => {
  beforeEach(() => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("SW_APM_")) Reflect.deleteProperty(process.env, key)
    }
    process.env.SW_APM_SERVICE_KEY = "token:name"
  })

  it("returns proper defaults", async () => {
    const config = await readConfig()
    const expected: ExtendedSwConfiguration = {
      token: "token",
      serviceName: "name",
      enabled: true,
      otelLogLevel: DiagLogLevel.INFO,
      oboeLogLevel: oboe.DEBUG_INFO,
      triggerTraceEnabled: true,
      runtimeMetrics: true,
      insertTraceContextIntoLogs: false,
      insertTraceContextIntoQueries: false,
      instrumentations: {},
      metrics: { interval: 60_000 },
      experimental: { otelCollector: false },
    }

    expect(config).to.deep.include(expected)
  })

  it("parses booleans", async () => {
    process.env.SW_APM_ENABLED = "0"

    const config = await readConfig()
    expect(config).to.include({ enabled: false })
  })

  it("parses tracing mode", async () => {
    process.env.SW_APM_TRACING_MODE = "enabled"

    const config = await readConfig()
    expect(config).to.include({ tracingMode: true })
  })

  it("parses trusted path", async () => {
    process.env.SW_APM_TRUSTED_PATH = "package.json"

    const config = await readConfig()
    expect(config.certificate).to.include("solarwinds-apm")
  })

  it("parses transaction settings", async () => {
    process.env.SW_APM_CONFIG_FILE = "test/test.config.js"

    const config = await readConfig()
    expect(config.transactionSettings).not.to.be.undefined
    expect(config.transactionSettings).to.have.length(3)
  })

  it("parses experimental env", async () => {
    process.env.SW_APM_EXPERIMENTAL_OTEL_COLLECTOR = "true"

    const config = await readConfig()
    expect(config.experimental.otelCollector).to.be.true
  })

  it("throws on bad boolean", async () => {
    process.env.SW_APM_ENABLED = "foo"

    await expect(readConfig()).to.be.rejected
  })

  it("throws on bad tracing mode", async () => {
    process.env.SW_APM_TRACING_MODE = "foo"

    await expect(readConfig()).to.be.rejected
  })

  it("throws on non-existent trusted path", async () => {
    process.env.SW_APM_TRUSTED_PATH = "foo"

    await expect(readConfig()).to.be.rejected
  })

  it("uses the right defaults for AppOptics", async () => {
    process.env.SW_APM_COLLECTOR = "collector.appoptics.com"

    const config = await readConfig()
    expect(config).to.include({
      metricFormat: 1,
      certificate: aoCert,
    })
  })
})

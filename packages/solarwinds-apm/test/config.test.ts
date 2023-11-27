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

import aoCert from "../src/appoptics.crt.js"
import { type ExtendedSwConfiguration, readConfig } from "../src/config.js"

describe("readConfig", () => {
  beforeEach(() => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("SW_APM_")) Reflect.deleteProperty(process.env, key)
    }
    process.env.SW_APM_SERVICE_KEY = "token:name"
  })

  it("returns proper defaults", () => {
    const config = readConfig()
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
      dev: {
        otlpTraces: false,
        otlpMetrics: false,
        swTraces: true,
        swMetrics: true,
        initMessage: true,
        resourceDetection: true,
      },
    }

    expect(config).to.deep.include(expected)
  })

  it("parses booleans", () => {
    process.env.SW_APM_ENABLED = "0"

    const config = readConfig()
    expect(config).to.include({ enabled: false })
  })

  it("parses tracing mode", () => {
    process.env.SW_APM_TRACING_MODE = "enabled"

    const config = readConfig()
    expect(config).to.include({ tracingMode: true })
  })

  it("parses trusted path", () => {
    process.env.SW_APM_TRUSTEDPATH = "package.json"

    const config = readConfig()
    expect(config.certificate).to.include("solarwinds-apm")
  })

  it("parses transaction settings", () => {
    process.env.SW_APM_CONFIG_FILE = "test/test.config.js"

    const config = readConfig()
    expect(config.transactionSettings).not.to.be.undefined
    expect(config.transactionSettings).to.have.length(3)
  })

  it("parses dev env", () => {
    process.env.SW_APM_DEV_OTLP_TRACES = "true"
    process.env.SW_APM_DEV_SW_METRICS = "0"

    const config = readConfig()
    expect(config.dev.otlpTraces).to.be.true
    expect(config.dev.swMetrics).to.be.false
  })

  it("throws on bad boolean", () => {
    process.env.SW_APM_ENABLED = "foo"

    expect(readConfig).to.throw()
  })

  it("throws on bad tracing mode", () => {
    process.env.SW_APM_TRACING_MODE = "foo"

    expect(readConfig).to.throw()
  })

  it("throws on non-existent trusted path", () => {
    process.env.SW_APM_TRUSTEDPATH = "foo"

    expect(readConfig).to.throw()
  })

  it("uses the right defaults for AppOptics", () => {
    process.env.SW_APM_COLLECTOR = "collector.appoptics.com"

    const config = readConfig()
    expect(config).to.include({
      metricFormat: 1,
      certificate: aoCert,
    })
  })
})

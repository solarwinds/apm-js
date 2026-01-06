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

import { DiagLogLevel } from "@opentelemetry/api"
import { type ReadableSpan } from "@opentelemetry/sdk-trace-base"
import { beforeEach, describe, expect, it } from "@solarwinds-apm/test"

import { type Configuration, read } from "../src/config.js"

describe("read", () => {
  beforeEach(() => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("SW_APM_") || key.startsWith("OTEL_")) {
        Reflect.deleteProperty(process.env, key)
      }
    }
    process.env.SW_APM_SERVICE_KEY = "token:name"
  })

  it("returns proper defaults", async () => {
    const config = await read()
    const expected: Configuration = {
      service: "name",
      token: "token",
      enabled: true,
      collector: new URL("https://apm.collector.na-01.cloud.solarwinds.com"),
      logLevel: DiagLogLevel.WARN,
      triggerTraceEnabled: true,
      runtimeMetrics: true,
      insertTraceContextIntoLogs: false,
      insertTraceContextIntoQueries: false,
      exportLogsEnabled: false,
      instrumentations: { configs: {}, extra: [], set: "all" },
      resourceDetectors: { configs: {}, extra: [], set: "all" },
      headers: {},
      otlp: {
        traces: "https://otel.collector.na-01.cloud.solarwinds.com/v1/traces",
        metrics: "https://otel.collector.na-01.cloud.solarwinds.com/v1/metrics",
        logs: "https://otel.collector.na-01.cloud.solarwinds.com/v1/logs",
      },
    }

    expect(config).to.loosely.deep.equal(expected)
  })

  it("properly sets OTLP endpoints", async () => {
    process.env.SW_APM_COLLECTOR = "apm.collector.na-01.cloud.solarwinds.com"

    const config = await read()
    expect(config.otlp).to.deep.equal({
      traces: "https://otel.collector.na-01.cloud.solarwinds.com/v1/traces",
      metrics: "https://otel.collector.na-01.cloud.solarwinds.com/v1/metrics",
      logs: "https://otel.collector.na-01.cloud.solarwinds.com/v1/logs",
    })
  })

  it("properly uses OTLP env endpoints", async () => {
    process.env.SW_APM_COLLECTOR = "apm.collector.na-01.cloud.solarwinds.com"
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://custom.endpoint"
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT =
      "http://custom.traces.endpoint/v1/traces"

    const config = await read()
    expect(config.otlp).to.deep.equal({
      traces: "http://custom.traces.endpoint/v1/traces",
      metrics: "http://custom.endpoint/v1/metrics",
      logs: "http://custom.endpoint/v1/logs",
    })
  })

  it("parses booleans", async () => {
    process.env.SW_APM_ENABLED = "0"

    const config = await read()
    expect(config).to.include({ enabled: false })
  })

  it("parses tracing mode", async () => {
    process.env.SW_APM_TRACING_MODE = "enabled"

    const config = await read()
    expect(config).to.include({ tracingMode: true })
  })

  it("parses trusted path", async () => {
    process.env.SW_APM_TRUSTEDPATH = "package.json"

    const config = await read()
    expect(config.trustedpath).to.include("solarwinds-apm")
  })

  it("parses otel service name", async () => {
    process.env.OTEL_SERVICE_NAME = "otel-name"

    const config = await read()
    expect(config.service).to.equal("otel-name")
  })

  it("properly disables logging", async () => {
    process.env.SW_APM_LOG_LEVEL = "none"

    const config = await read()
    expect(config.logLevel).to.equal(DiagLogLevel.NONE)
  })

  it("throws on bad boolean", async () => {
    process.env.SW_APM_ENABLED = "foo"

    await expect(read()).to.be.rejected
  })

  it("throws on bad tracing mode", async () => {
    process.env.SW_APM_TRACING_MODE = "foo"

    await expect(read()).to.be.rejected
  })

  it("throws on non-existent trusted path", async () => {
    process.env.SW_APM_TRUSTEDPATH = "foo"

    await expect(read()).to.be.rejected
  })

  it("supports logs export by default", async () => {
    process.env.SW_APM_EXPORT_LOGS_ENABLED = "true"

    const config = await read()
    expect(config.exportLogsEnabled).to.be.true
  })

  it("supports cjs configs", async () => {
    process.env.SW_APM_CONFIG_FILE = "test/configs/commonjs.cjs"

    const config = await read()
    expect(config.transactionName).not.to.be.undefined
    expect(config.transactionName!(null!)).to.equal("cjs")
  })

  describe("transactionSettings", () => {
    let config: Configuration
    before(async () => {
      process.env.SW_APM_CONFIG_FILE = "test/configs/transaction-settings.js"
      config = await read()
    })

    it("supports regex literals", () => {
      const setting = config.transactionSettings![0]!

      expect(setting.tracing).to.be.true
      expect(setting.matcher("hello")).to.be.true
      expect(setting.matcher("Hello !")).to.be.false
    })

    it("supports string literals as regexes", () => {
      const setting = config.transactionSettings![1]!

      expect(setting.tracing).to.be.false
      expect(setting.matcher("Hello !")).to.be.true
      expect(setting.matcher("hello")).to.be.false
    })

    it("supports matcher functions", () => {
      const setting = config.transactionSettings![2]!

      expect(setting.tracing).to.be.true
      expect(setting.matcher("foobar")).to.be.true
      expect(setting.matcher("barfoo")).to.be.false
    })
  })

  describe("transactionName", () => {
    it("supports string literals", async () => {
      process.env.SW_APM_CONFIG_FILE =
        "test/configs/transaction-name.literal.js"
      const config = await read()

      expect(config.transactionName?.(null!)).to.equal("name")
    })

    it("supports functions", async () => {
      process.env.SW_APM_CONFIG_FILE =
        "test/configs/transaction-name.function.js"
      const config = await read()

      expect(
        config.transactionName?.({ name: "one" } as ReadableSpan),
      ).to.equal("one")
      expect(
        config.transactionName?.({ name: "two" } as ReadableSpan),
      ).to.equal("two")
    })

    it("supports schemes", async () => {
      process.env.SW_APM_CONFIG_FILE =
        "test/configs/transaction-name.schemes.js"
      const config = await read()

      expect(
        config.transactionName?.({
          attributes: { one: true },
        } as unknown as ReadableSpan),
      ).to.equal("true")
      expect(
        config.transactionName?.({
          attributes: { one: true, two: 2 },
        } as unknown as ReadableSpan),
      ).to.equal("true:2")
      expect(
        config.transactionName?.({
          attributes: { one: true, two: 2, three: "three" },
        } as unknown as ReadableSpan),
      ).to.equal("true-2-three")
    })
  })
})

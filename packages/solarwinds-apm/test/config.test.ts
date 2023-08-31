import { DiagLogLevel } from "@opentelemetry/api"
import { ExtendedSwConfiguration, readConfig } from "../src/config"
import { describe, it, expect, beforeEach } from "@solarwinds-apm/test"
import { oboe } from "@solarwinds-apm/bindings"

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
    process.env.SW_APM_TRUSTED_PATH = "package.json"

    const config = readConfig()
    expect(config.certificate).to.include("solarwinds-apm")
  })

  it("parses transaction settings", () => {
    process.env.SW_APM_CONFIG_FILE = "test/test.config.js"

    const config = readConfig()
    expect(config.transactionSettings).not.to.be.undefined
    expect(config.transactionSettings).to.have.length(3)
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
    process.env.SW_APM_TRUSTED_PATH = "foo"

    expect(readConfig).to.throw()
  })
})

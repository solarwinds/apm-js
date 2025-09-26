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

import { type IncomingMessage, type ServerResponse } from "node:http"

import {
  type Context,
  diag,
  type TextMapPropagator,
  type TextMapSetter,
} from "@opentelemetry/api"
import { afterEach, describe, expect, it } from "@solarwinds-apm/test"

import { type Configuration } from "../src/config.js"
import { type Options, patch, patchEnv } from "../src/patches.js"

class TestResponsePropagator implements TextMapPropagator<unknown> {
  inject(
    _context: Context,
    carrier: unknown,
    setter: TextMapSetter<unknown>,
  ): void {
    setter.set(carrier, "X-Test", "hello")
  }
  extract(context: Context): Context {
    return context
  }

  fields(): string[] {
    return ["X-Test"]
  }
}

describe("patch", () => {
  const options = {
    service: "service",
    insertTraceContextIntoLogs: false,
    insertTraceContextIntoQueries: false,
    exportLogsEnabled: false,
    responsePropagator: new TestResponsePropagator(),
  } as unknown as Options

  it("sets proper defaults", () => {
    const configs = patch({}, options, diag)

    expect(configs["@fastify/otel"]).to.deep.equal({
      registerOnInitialization: true,
    })
    expect(configs["@opentelemetry/instrumentation-aws-lambda"]).to.deep.equal({
      enabled: false,
    })
    expect(configs["@opentelemetry/instrumentation-aws-sdk"]).to.deep.equal({})
    expect(configs["@opentelemetry/instrumentation-fs"]).to.deep.equal({
      enabled: false,
      requireParentSpan: true,
    })
    expect(configs["@opentelemetry/instrumentation-mysql2"]).to.deep.equal({
      addSqlCommenterCommentToQueries: false,
    })
    expect(configs["@opentelemetry/instrumentation-pg"]).to.deep.equal({
      requireParentSpan: true,
      addSqlCommenterCommentToQueries: false,
    })
    expect(configs["@opentelemetry/instrumentation-dns"]).to.deep.equal({
      enabled: false,
    })
    expect(configs["@opentelemetry/instrumentation-net"]).to.deep.equal({
      enabled: false,
    })
    expect(configs["@opentelemetry/instrumentation-bunyan"]).to.deep.include({
      disableLogCorrelation: true,
      disableLogSending: true,
    })
    expect(configs["@opentelemetry/instrumentation-pino"]).to.deep.include({
      disableLogCorrelation: true,
      disableLogSending: true,
    })
    expect(configs["@opentelemetry/instrumentation-winston"]).to.deep.include({
      disableLogCorrelation: true,
      disableLogSending: true,
    })
  })

  describe("@fastify/otel", () => {
    it("respects user values", () => {
      const configs = patch(
        {
          "@fastify/otel": {
            registerOnInitialization: false,
          },
        },
        options,
        diag,
      )

      expect(configs["@fastify/otel"]).to.deep.equal({
        registerOnInitialization: false,
      })
    })
  })

  describe("@opentelemetry/instrumentation-aws-lambda", () => {
    afterEach(() => {
      Reflect.deleteProperty(process.env, "AWS_LAMBDA_FUNCTION_NAME")
    })

    it("is enabled in lambda environments", () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = "lambda"

      const configs = patch({}, options, diag)

      expect(
        configs["@opentelemetry/instrumentation-aws-lambda"],
      ).to.deep.equal({
        enabled: true,
      })
    })

    it("respects user values outside lambda environments", () => {
      const configs = patch(
        {
          "@opentelemetry/instrumentation-aws-lambda": {
            enabled: true,
          },
        },
        options,
        diag,
      )

      expect(
        configs["@opentelemetry/instrumentation-aws-lambda"],
      ).to.deep.equal({
        enabled: true,
      })
    })

    it("respects user values in lambda environments", () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = "lambda"

      const configs = patch(
        {
          "@opentelemetry/instrumentation-aws-lambda": {
            enabled: false,
          },
        },
        options,
        diag,
      )

      expect(
        configs["@opentelemetry/instrumentation-aws-lambda"],
      ).to.deep.equal({
        enabled: false,
      })
    })
  })

  describe("@opentelemetry/instrumentation-aws-sdk", () => {
    afterEach(() => {
      Reflect.deleteProperty(process.env, "AWS_LAMBDA_FUNCTION_NAME")
    })

    it("is enabled in lambda environments", () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = "lambda"

      const configs = patch({}, options, diag)

      expect(configs["@opentelemetry/instrumentation-aws-sdk"]).to.deep.equal({
        enabled: true,
      })
    })

    it("respects user values in lambda environments", () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = "lambda"

      const configs = patch(
        {
          "@opentelemetry/instrumentation-aws-sdk": {
            enabled: false,
          },
        },
        options,
        diag,
      )

      expect(configs["@opentelemetry/instrumentation-aws-sdk"]).to.deep.equal({
        enabled: false,
      })
    })
  })

  describe("@opentelemetry/instrumentation-http", () => {
    it("injects headers in response hook", () => {
      const configs = patch({}, options, diag)
      const response = {
        headers: {} as Record<string, string>,
        hasHeader(name: string) {
          return name in this.headers
        },
        setHeader(name: string, value: string) {
          this.headers[name] = value
        },
      }
      configs["@opentelemetry/instrumentation-http"]!.responseHook!(
        null!,
        response as unknown as ServerResponse,
      )

      expect(response.headers).to.deep.equal({ "X-Test": "hello" })
    })

    it("doesn't inject headers for incoming responses in response hook", () => {
      const configs = patch({}, options, diag)
      const response = {
        headers: {} as Record<string, string>,
      }
      configs["@opentelemetry/instrumentation-http"]!.responseHook!(
        null!,
        response as IncomingMessage,
      )

      expect(response.headers).to.deep.equal({})
    })

    it("doesn't override headers in response hook", () => {
      const configs = patch({}, options, diag)
      const response = {
        headers: {
          "X-Test": "goodbye",
        } as Record<string, string>,
        hasHeader(name: string) {
          return name in this.headers
        },
        setHeader(name: string, value: string) {
          this.headers[name] = value
        },
      }
      configs["@opentelemetry/instrumentation-http"]!.responseHook!(
        null!,
        response as unknown as ServerResponse,
      )

      expect(response.headers).to.deep.equal({ "X-Test": "goodbye" })
    })

    it("calls custom response hook in response hook", () => {
      const configs = patch(
        {
          "@opentelemetry/instrumentation-http": {
            responseHook(_span, response) {
              ;(response as ServerResponse).setHeader("X-Custom", "http")
            },
          },
        },
        options,
        diag,
      )
      const response = {
        headers: {} as Record<string, string>,
        hasHeader(name: string) {
          return name in this.headers
        },
        setHeader(name: string, value: string) {
          this.headers[name] = value
        },
      }
      configs["@opentelemetry/instrumentation-http"]!.responseHook!(
        null!,
        response as unknown as ServerResponse,
      )

      expect(response.headers).to.deep.equal({
        "X-Test": "hello",
        "X-Custom": "http",
      })
    })
  })

  describe("@opentelemetry/instrumentation-mysql2", () => {
    it("respects custom config", () => {
      const configs = patch(
        {},
        { ...options, insertTraceContextIntoQueries: true },
        diag,
      )

      expect(configs["@opentelemetry/instrumentation-mysql2"]).to.deep.equal({
        addSqlCommenterCommentToQueries: true,
      })
    })

    it("respects user values over defaults", () => {
      const configs = patch(
        {
          "@opentelemetry/instrumentation-mysql2": {
            addSqlCommenterCommentToQueries: true,
          },
        },
        options,
        diag,
      )

      expect(configs["@opentelemetry/instrumentation-mysql2"]).to.deep.equal({
        addSqlCommenterCommentToQueries: true,
      })
    })

    it("respects user values over custom config", () => {
      const configs = patch(
        {
          "@opentelemetry/instrumentation-mysql2": {
            addSqlCommenterCommentToQueries: false,
          },
        },
        { ...options, insertTraceContextIntoQueries: true },
        diag,
      )

      expect(configs["@opentelemetry/instrumentation-mysql2"]).to.deep.equal({
        addSqlCommenterCommentToQueries: false,
      })
    })
  })

  describe("@opentelemetry/instrumentation-pg", () => {
    it("respects custom config", () => {
      const configs = patch(
        {},
        { ...options, insertTraceContextIntoQueries: true },
        diag,
      )

      expect(configs["@opentelemetry/instrumentation-pg"]).to.deep.equal({
        requireParentSpan: true,
        addSqlCommenterCommentToQueries: true,
      })
    })

    it("respects user values over defaults", () => {
      const configs = patch(
        {
          "@opentelemetry/instrumentation-pg": {
            requireParentSpan: false,
            addSqlCommenterCommentToQueries: true,
          },
        },
        options,
        diag,
      )

      expect(configs["@opentelemetry/instrumentation-pg"]).to.deep.equal({
        requireParentSpan: false,
        addSqlCommenterCommentToQueries: true,
      })
    })

    it("respects user values over custom config", () => {
      const configs = patch(
        {
          "@opentelemetry/instrumentation-pg": {
            requireParentSpan: false,
            addSqlCommenterCommentToQueries: false,
          },
        },
        { ...options, insertTraceContextIntoQueries: true },
        diag,
      )

      expect(configs["@opentelemetry/instrumentation-pg"]).to.deep.equal({
        requireParentSpan: false,
        addSqlCommenterCommentToQueries: false,
      })
    })
  })

  describe("logging instrumentations", () => {
    const INSTRUMENTATIONS = [
      "@opentelemetry/instrumentation-bunyan",
      "@opentelemetry/instrumentation-pino",
      "@opentelemetry/instrumentation-winston",
    ] as const

    it("respect custom config", () => {
      const configs = patch(
        {},
        {
          ...options,
          insertTraceContextIntoLogs: true,
          exportLogsEnabled: true,
        },
        diag,
      )

      for (const i of INSTRUMENTATIONS) {
        expect(configs[i]).to.deep.include({
          disableLogCorrelation: false,
          disableLogSending: false,
        })
      }
    })

    it("respect user values over defaults", () => {
      const configs = patch(
        {
          "@opentelemetry/instrumentation-bunyan": {
            disableLogCorrelation: false,
            disableLogSending: false,
          },
          "@opentelemetry/instrumentation-pino": {
            disableLogCorrelation: false,
            disableLogSending: false,
          },
          "@opentelemetry/instrumentation-winston": {
            disableLogCorrelation: false,
            disableLogSending: false,
          },
        },
        options,
        diag,
      )

      for (const i of INSTRUMENTATIONS) {
        expect(configs[i]).to.deep.include({
          disableLogCorrelation: false,
          disableLogSending: false,
        })
      }
    })

    it("respect user values over custom config", () => {
      const configs = patch(
        {
          "@opentelemetry/instrumentation-bunyan": {
            disableLogCorrelation: true,
            disableLogSending: true,
          },
          "@opentelemetry/instrumentation-pino": {
            disableLogCorrelation: true,
            disableLogSending: true,
          },
          "@opentelemetry/instrumentation-winston": {
            disableLogCorrelation: true,
            disableLogSending: true,
          },
        },
        {
          ...options,
          insertTraceContextIntoLogs: true,
          exportLogsEnabled: true,
        },
        diag,
      )

      for (const i of INSTRUMENTATIONS) {
        expect(configs[i]).to.deep.include({
          disableLogCorrelation: true,
          disableLogSending: true,
        })
      }
    })

    it("add service name in log hook", () => {
      const configs = patch({}, options, diag)

      for (const i of INSTRUMENTATIONS) {
        const record: Record<string, unknown> = {}
        configs[i]!.logHook!(null!, record)

        expect(record).to.deep.equal({
          "resource.service.name": "service",
        })
      }
    })

    it("don't override service name in log hook", () => {
      const configs = patch({}, options, diag)

      for (const i of INSTRUMENTATIONS) {
        const record: Record<string, unknown> = {
          "resource.service.name": "evil service",
        }
        configs[i]!.logHook!(null!, record)

        expect(record).to.deep.equal({
          "resource.service.name": "evil service",
        })
      }
    })

    it("calls custom log hook in log hook", () => {
      const configs = patch(
        {
          "@opentelemetry/instrumentation-bunyan": {
            logHook(_span, record) {
              record.instrumentation = "@opentelemetry/instrumentation-bunyan"
            },
          },
          "@opentelemetry/instrumentation-pino": {
            logHook(_span, record) {
              record.instrumentation = "@opentelemetry/instrumentation-pino"
            },
          },
          "@opentelemetry/instrumentation-winston": {
            logHook(_span, record) {
              record.instrumentation = "@opentelemetry/instrumentation-winston"
            },
          },
        },
        options,
        diag,
      )

      for (const i of INSTRUMENTATIONS) {
        const record: Record<string, unknown> = {}
        configs[i]!.logHook!(null!, record)

        expect(record).to.deep.equal({
          "resource.service.name": "service",
          instrumentation: i,
        })
      }
    })
  })
})

describe("patchEnv", () => {
  const config = {} as Configuration

  it("sets proper defaults", () => {
    const env: NodeJS.ProcessEnv = {}
    patchEnv(config, env)

    expect(env).to.loosely.deep.equal({
      OTEL_SEMCONV_STABILITY_OPT_IN: "http,database/dup,messaging/dup,k8s/dup",
    })
  })

  describe("OTEL_SEMCONV_STABILITY_OPT_IN", () => {
    it("respects user values", () => {
      const env: NodeJS.ProcessEnv = {
        OTEL_SEMCONV_STABILITY_OPT_IN:
          "http/dup, database, foo, messaging, bar/dup, k8s",
      }
      patchEnv(config, env)

      expect(env.OTEL_SEMCONV_STABILITY_OPT_IN).to.equal(
        "http/dup,database,foo,messaging,bar/dup,k8s",
      )
    })

    it("adds database and http if unspecified", () => {
      const env: NodeJS.ProcessEnv = {
        OTEL_SEMCONV_STABILITY_OPT_IN: "foo, messaging, bar/dup, k8s",
      }
      patchEnv(config, env)

      expect(env.OTEL_SEMCONV_STABILITY_OPT_IN).to.equal(
        "foo,messaging,bar/dup,k8s,http,database/dup",
      )
    })

    it("adds messaging and k8s if unspecified", () => {
      const env: NodeJS.ProcessEnv = {
        OTEL_SEMCONV_STABILITY_OPT_IN: "http/dup, database",
      }
      patchEnv(config, env)

      expect(env.OTEL_SEMCONV_STABILITY_OPT_IN).to.equal(
        "http/dup,database,messaging/dup,k8s/dup",
      )
    })
  })
})

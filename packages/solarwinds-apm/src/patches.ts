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

import {
  context,
  type DiagLogger,
  type Span,
  type TextMapPropagator,
  trace,
} from "@opentelemetry/api"
import { type InstrumentationConfigMap } from "@solarwinds-apm/instrumentations"

import { type Configuration } from "./config.js"
import { environment } from "./env.js"

export interface Options extends Configuration {
  responsePropagator: TextMapPropagator<unknown>
}

export function patch(
  configs: InstrumentationConfigMap,
  options: Options,
  logger: DiagLogger,
): InstrumentationConfigMap {
  for (const patcher of PATCHERS) {
    patcher(configs, options)
  }
  logger.debug("patched instrumentation configs", configs)
  return configs
}

export function patchEnv(config: Configuration, env = process.env): void {
  for (const patcher of ENV_PATCHERS) {
    patcher(env, config)
  }
}

function patcher<const Name extends keyof InstrumentationConfigMap>(
  names: readonly Name[],
  patch: (
    config: NonNullable<InstrumentationConfigMap[Name]>,
    options: Options,
  ) => void,
): (configs: InstrumentationConfigMap, options: Options) => void {
  return (configs, options) => {
    for (const name of names) {
      patch((configs[name] ??= {}), options)
    }
  }
}

function envPatcher(
  names: readonly string[],
  patch: (
    value: string | undefined,
    config: Configuration,
  ) => string | undefined,
) {
  return (env: NodeJS.ProcessEnv, config: Configuration) => {
    for (const name of names) {
      env[name] = patch(env[name], config)
    }
  }
}

const PATCHERS = [
  patcher(["@fastify/otel"], (config) => {
    config.registerOnInitialization ??= true
  }),

  patcher(["@opentelemetry/instrumentation-aws-lambda"], (config) => {
    config.enabled ??= environment.IS_AWS_LAMBDA
  }),

  patcher(["@opentelemetry/instrumentation-aws-sdk"], (config) => {
    if (environment.IS_AWS_LAMBDA) {
      config.enabled ??= true
    }
  }),

  patcher(["@opentelemetry/instrumentation-cassandra-driver"], (config) => {
    config.enhancedDatabaseReporting ??= true
  }),

  patcher(["@opentelemetry/instrumentation-fs"], (config) => {
    config.enabled ??= false
    config.requireParentSpan ??= true
  }),

  patcher(["@opentelemetry/instrumentation-http"], (config, options) => {
    const original = config.responseHook
    config.responseHook = (span, response) => {
      // only for server responses originating from the instrumented app
      if ("setHeader" in response) {
        const ctx = trace.setSpan(context.active(), span)
        options.responsePropagator.inject(ctx, response, {
          set: (res: typeof response, k, v) => {
            if (!res.hasHeader(k)) {
              res.setHeader(k, v)
            }
          },
        })
      }

      original?.(span, response)
    }
  }),

  patcher(["@opentelemetry/instrumentation-mysql2"], (config, options) => {
    config.addSqlCommenterCommentToQueries ??=
      options.insertTraceContextIntoQueries
  }),

  patcher(["@opentelemetry/instrumentation-pg"], (config, options) => {
    config.requireParentSpan ??= true
    config.addSqlCommenterCommentToQueries ??=
      options.insertTraceContextIntoQueries
  }),

  patcher(
    ["@opentelemetry/instrumentation-runtime-node"],
    (config, options) => {
      config.enabled ??= options.runtimeMetrics
    },
  ),

  patcher(
    [
      "@opentelemetry/instrumentation-dns",
      "@opentelemetry/instrumentation-net",
    ],
    (config) => {
      config.enabled ??= false
    },
  ),

  patcher(
    [
      "@opentelemetry/instrumentation-bunyan",
      "@opentelemetry/instrumentation-pino",
      "@opentelemetry/instrumentation-winston",
    ],
    (config, options) => {
      config.disableLogCorrelation ??= !options.insertTraceContextIntoLogs
      config.disableLogSending ??= !options.exportLogsEnabled

      const original = config.logHook
      config.logHook = (span: Span, record: Record<string, unknown>) => {
        record["resource.service.name"] ??= options.service

        original?.(span, record)
      }
    },
  ),
]

const ENV_PATCHERS = [
  envPatcher(["OTEL_SEMCONV_STABILITY_OPT_IN"], (value) => {
    const flags =
      value
        ?.split(",")
        .map((f) => f.trim())
        .filter((f) => f !== "") ?? []
    const explicit = new Set(flags.map((f) => f.split("/")[0]!))

    // stable semconv only for http
    if (!explicit.has("http")) {
      flags.push("http")
    }

    // both stable and experimental for others
    if (!explicit.has("database")) {
      flags.push("database/dup")
    }
    if (!explicit.has("messaging")) {
      flags.push("messaging/dup")
    }
    if (!explicit.has("k8s")) {
      flags.push("k8s/dup")
    }

    return flags.join(",")
  }),
]

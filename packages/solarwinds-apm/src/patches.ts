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

  patcher(["@opentelemetry/instrumentation-fs"], (config) => {
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

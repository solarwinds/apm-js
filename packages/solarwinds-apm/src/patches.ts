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

import {
  ROOT_CONTEXT,
  type Span,
  type TextMapPropagator,
  trace,
} from "@opentelemetry/api"
import { type InstrumentationConfigMap } from "@solarwinds-apm/instrumentations"
import { IS_AWS_LAMBDA } from "@solarwinds-apm/module"
import { type SwConfiguration } from "@solarwinds-apm/sdk"

export interface Options extends SwConfiguration {
  responsePropagator: TextMapPropagator<unknown>
}

export function patch(
  configs: InstrumentationConfigMap,
  options: Options,
): void {
  for (const patcher of PATCHERS) {
    patcher(configs, options)
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

const PATCHERS = [
  patcher(["@opentelemetry/instrumentation-aws-lambda"], (config) => {
    config.enabled ??= IS_AWS_LAMBDA
    config.disableAwsContextPropagation ??= true
  }),

  patcher(["@opentelemetry/instrumentation-aws-sdk"], (config) => {
    if (IS_AWS_LAMBDA) {
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
        const context = trace.setSpan(ROOT_CONTEXT, span)
        options.responsePropagator.inject(context, response, {
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
    [
      "@opentelemetry/instrumentation-bunyan",
      "@opentelemetry/instrumentation-pino",
      "@opentelemetry/instrumentation-winston",
    ],
    (config, options) => {
      config.enabled ??= options.insertTraceContextIntoLogs
      config.disableLogSending ??= !options.exportLogsEnabled

      const original = config.logHook
      config.logHook = (span: Span, record: Record<string, unknown>) => {
        record["resource.service.name"] ??= options.serviceName

        original?.(span, record)
      }
    },
  ),
]

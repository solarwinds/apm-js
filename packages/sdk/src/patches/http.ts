import { type ServerResponse } from "node:http"

import { ROOT_CONTEXT, trace } from "@opentelemetry/api"
import { type HttpInstrumentationConfig } from "@opentelemetry/instrumentation-http"

import { type ConfigPatcher } from "../config-patcher"
import { type Options } from "."

let instrumentationHttp:
  | typeof import("@opentelemetry/instrumentation-http")
  | undefined
try {
  /* eslint-disable-next-line ts/no-unsafe-assignment */
  instrumentationHttp = require("@opentelemetry/instrumentation-http")
} catch {
  instrumentationHttp = undefined
}

export function patch(patcher: ConfigPatcher, options: Options) {
  if (!instrumentationHttp) return

  patcher.patch(
    instrumentationHttp.HttpInstrumentation,
    (config: HttpInstrumentationConfig) =>
      ({
        ...config,
        responseHook: (span, response) => {
          // only for server responses originating from the instrumented app
          if ("setHeader" in response) {
            const context = trace.setSpan(ROOT_CONTEXT, span)
            options.traceOptionsResponsePropagator.inject(context, response, {
              set: (res, k, v) => (res as ServerResponse).setHeader(k, v),
            })
          }

          config.responseHook?.(span, response)
        },
      } satisfies HttpInstrumentationConfig),
  )
}

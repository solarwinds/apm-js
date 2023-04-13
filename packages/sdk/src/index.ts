import { type ServerResponse } from "node:http"
import * as os from "node:os"

import {
  diag,
  ROOT_CONTEXT,
  type TextMapPropagator,
  trace,
} from "@opentelemetry/api"
import { CompositePropagator, W3CBaggagePropagator } from "@opentelemetry/core"
import {
  type HttpInstrumentation,
  type HttpInstrumentationConfig,
} from "@opentelemetry/instrumentation-http"
import { NodeSDK } from "@opentelemetry/sdk-node"
import {
  ParentBasedSampler,
  type Sampler,
  type SpanExporter,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace-base"

import { CompoundSpanProcessor } from "./compound-processor"
import { init, type SwoConfiguration } from "./config"
import { SwoExporter } from "./exporter"
import { SwoInboundMetricsSpanProcessor } from "./inbound-metrics-processor"
import { SwoParentInfoSpanProcessor } from "./parent-info-processor"
import { SwoSampler } from "./sampler"
import { SwoTraceContextOptionsPropagator } from "./trace-context-options-propagator"
import { SwoTraceOptionsResponsePropagator } from "./trace-options-response-propagator"

export type { SwoConfiguration } from "./config"

export const SUPPORTED_PLATFORMS = ["linux-arm64", "linux-x64"]
export const CURRENT_PLATFORM = `${os.platform()}-${os.arch()}`
export const CURRENT_PLATFORM_SUPPORTED =
  SUPPORTED_PLATFORMS.includes(CURRENT_PLATFORM)

let instrumentationHttp:
  | typeof import("@opentelemetry/instrumentation-http")
  | undefined
try {
  /* eslint-disable-next-line ts/no-unsafe-assignment */
  instrumentationHttp = require("@opentelemetry/instrumentation-http")
} catch {
  instrumentationHttp = undefined
}

export class SwoSDK extends NodeSDK {
  constructor(config: SwoConfiguration) {
    const logger = diag.createComponentLogger({ namespace: "swo" })

    let sampler: Sampler | undefined = undefined
    let traceExporter: SpanExporter | undefined = undefined
    let spanProcessor: SpanProcessor | undefined = undefined
    let textMapPropagator: TextMapPropagator | undefined = undefined

    if (CURRENT_PLATFORM_SUPPORTED) {
      try {
        const reporter = init(
          config,
          diag.createComponentLogger({ namespace: "swo/init" }),
        )

        const swoSampler = new SwoSampler(
          config,
          diag.createComponentLogger({ namespace: "swo/sampler" }),
        )
        sampler = new ParentBasedSampler({
          root: swoSampler,
          remoteParentSampled: swoSampler,
          remoteParentNotSampled: swoSampler,
        })

        traceExporter = new SwoExporter(
          reporter,
          diag.createComponentLogger({ namespace: "swo/exporter" }),
        )

        const parentInfoProcessor = new SwoParentInfoSpanProcessor()
        const inboundMetricsProcessor = new SwoInboundMetricsSpanProcessor()
        spanProcessor = new CompoundSpanProcessor(traceExporter, [
          parentInfoProcessor,
          inboundMetricsProcessor,
        ])

        const baggagePropagator = new W3CBaggagePropagator()
        const traceContextOptionsPropagator =
          new SwoTraceContextOptionsPropagator(
            diag.createComponentLogger({ namespace: "swo/propagator" }),
          )
        textMapPropagator = new CompositePropagator({
          propagators: [traceContextOptionsPropagator, baggagePropagator],
        })

        const traceOptionsResponsePropagator =
          new SwoTraceOptionsResponsePropagator()

        const isHttpInstrumentation = (i: unknown): i is HttpInstrumentation =>
          instrumentationHttp
            ? i instanceof instrumentationHttp.HttpInstrumentation
            : false
        const httpInstrumentation = config.instrumentations
          ?.flat()
          ?.find(isHttpInstrumentation)
        if (httpInstrumentation) {
          httpInstrumentation.setConfig(
            SwoSDK.httpConfig(
              httpInstrumentation.getConfig(),
              traceOptionsResponsePropagator,
            ),
          )
        }
      } catch (error) {
        logger.error(
          "initialization failed, no traces will be collected. check your configuration to ensure it is correct.",
          error,
        )
      }
    } else {
      logger.warn(
        "THE CURRENT PLATFORM IS NOT SUPPORTED; TRACE COLLECTION WILL BE DISABLED.",
        `current platform: ${CURRENT_PLATFORM}`,
        `supported platforms: ${SUPPORTED_PLATFORMS.join(", ")}`,
      )
    }

    super({
      ...config,
      sampler,
      traceExporter,
      spanProcessor,
      textMapPropagator,
    })
  }

  private static httpConfig(
    base: HttpInstrumentationConfig,
    responsePropagator: TextMapPropagator<unknown>,
  ): HttpInstrumentationConfig {
    return {
      ...base,
      responseHook: (span, response) => {
        // only for server responses originating from the instrumented app
        if ("setHeader" in response) {
          const context = trace.setSpan(ROOT_CONTEXT, span)
          responsePropagator.inject(context, response, {
            set: (res, k, v) => (res as ServerResponse).setHeader(k, v),
          })
        }

        base.responseHook?.(span, response)
      },
    }
  }
}

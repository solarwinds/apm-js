import { type ServerResponse } from "node:http"
import * as os from "node:os"

import { ROOT_CONTEXT, type TextMapPropagator, trace } from "@opentelemetry/api"
import { CompositePropagator, W3CBaggagePropagator } from "@opentelemetry/core"
import {
  HttpInstrumentation,
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

export const SUPPORTED_PLATFORMS = ["linux-arm64", "linux-x64"]
export const CURRENT_PLATFORM = `${os.platform()}-${os.arch()}`
export const CURRENT_PLATFORM_SUPPORTED =
  SUPPORTED_PLATFORMS.includes(CURRENT_PLATFORM)

let HttpInstrumentationClass: typeof HttpInstrumentation | undefined
try {
  HttpInstrumentationClass =
    require("@opentelemetry/instrumentation-http").HttpInstrumentation
} catch {
  HttpInstrumentationClass = undefined
}

export class SwoSDK extends NodeSDK {
  constructor(config: SwoConfiguration) {
    let sampler: Sampler | undefined = undefined
    let traceExporter: SpanExporter | undefined = undefined
    let spanProcessor: SpanProcessor | undefined = undefined
    let textMapPropagator: TextMapPropagator | undefined = undefined

    if (CURRENT_PLATFORM_SUPPORTED) {
      try {
        const reporter = init(config)

        const swoSampler = new SwoSampler(config)
        sampler = new ParentBasedSampler({
          root: swoSampler,
          remoteParentSampled: swoSampler,
          remoteParentNotSampled: swoSampler,
        })

        traceExporter = new SwoExporter(reporter)

        const parentInfoProcessor = new SwoParentInfoSpanProcessor()
        const inboundMetricsProcessor = new SwoInboundMetricsSpanProcessor()
        spanProcessor = new CompoundSpanProcessor(traceExporter, [
          parentInfoProcessor,
          inboundMetricsProcessor,
        ])

        const baggagePropagator = new W3CBaggagePropagator()
        const traceContextOptionsPropagator =
          new SwoTraceContextOptionsPropagator()
        textMapPropagator = new CompositePropagator({
          propagators: [traceContextOptionsPropagator, baggagePropagator],
        })

        const traceOptionsResponsePropagator =
          new SwoTraceOptionsResponsePropagator()

        console.log(HttpInstrumentationClass)
        const isHttpInstrumentation = (i: unknown): i is HttpInstrumentation =>
          HttpInstrumentationClass
            ? i instanceof HttpInstrumentationClass
            : false
        const httpInstrumentation = config.instrumentations
          ?.flat()
          ?.find(isHttpInstrumentation)
        console.log(config.instrumentations)
        console.log(httpInstrumentation)
        if (httpInstrumentation) {
          httpInstrumentation.setConfig(
            SwoSDK.httpConfig(
              httpInstrumentation.getConfig(),
              traceOptionsResponsePropagator,
            ),
          )
        }
      } catch (error) {
        console.warn(
          "swo initialization failed, no traces will be collected. check your configuration to ensure it is correct.",
          error,
        )
      }
    } else {
      console.warn(
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

        base?.responseHook?.(span, response)
      },
    }
  }
}

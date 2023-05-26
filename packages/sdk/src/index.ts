import * as os from "node:os"

import { diag, type TextMapPropagator } from "@opentelemetry/api"
import { CompositePropagator, W3CBaggagePropagator } from "@opentelemetry/core"
import { NodeSDK } from "@opentelemetry/sdk-node"
import {
  ParentBasedSampler,
  type Sampler,
  type SpanExporter,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace-base"
import { oboe } from "@swotel/bindings"

import { CompoundSpanProcessor } from "./compound-processor"
import { init, type SwoConfiguration } from "./config"
import { SwoExporter } from "./exporter"
import { SwoInboundMetricsSpanProcessor } from "./inbound-metrics-processor"
import { SwoParentInfoSpanProcessor } from "./parent-info-processor"
import { patch } from "./patches"
import { SwoSampler } from "./sampler"
import { SwoTraceContextOptionsPropagator } from "./trace-context-options-propagator"
import { SwoTraceOptionsResponsePropagator } from "./trace-options-response-propagator"

export type { SwoConfiguration } from "./config"

export const SUPPORTED_PLATFORMS = ["linux-arm64", "linux-x64"]
export const CURRENT_PLATFORM = `${os.platform()}-${os.arch()}`
export const CURRENT_PLATFORM_SUPPORTED =
  SUPPORTED_PLATFORMS.includes(CURRENT_PLATFORM)

export class SwoSDK extends NodeSDK {
  constructor(config: SwoConfiguration) {
    const logger = diag.createComponentLogger({ namespace: "swo" })

    let sampler: Sampler | undefined = undefined
    let traceExporter: SpanExporter | undefined = undefined
    let spanProcessor: SpanProcessor | undefined = undefined
    let textMapPropagator: TextMapPropagator | undefined = undefined

    if (CURRENT_PLATFORM_SUPPORTED && !(oboe instanceof Error)) {
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

        patch(config.instrumentations, { traceOptionsResponsePropagator })
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
      logger.debug("oboe", oboe)
    }

    super({
      ...config,
      sampler,
      traceExporter,
      spanProcessor,
      textMapPropagator,
    })
  }
}

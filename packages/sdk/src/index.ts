import { type TextMapPropagator } from "@opentelemetry/api"
import {
  W3CBaggagePropagator,
  W3CTraceContextPropagator,
} from "@opentelemetry/core"
import { NodeSDK } from "@opentelemetry/sdk-node"
import {
  ParentBasedSampler,
  type Sampler,
  type SpanExporter,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace-base"
import * as os from "os"

import { CompoundSpanProcessor } from "./compound-processor"
import { CompoundPropagator } from "./compound-propagator"
import { init, type SwoConfiguration } from "./config"
import { SwoExporter } from "./exporter"
import { SwoInboundMetricsSpanProcessor } from "./inbound-metrics-processor"
import { SwoParentInfoSpanProcessor } from "./parent-info-processor"
import { SwoSampler } from "./sampler"

export const SUPPORTED_PLATFORMS = ["linux-arm64", "linux-x64"]
export const CURRENT_PLATFORM = `${os.platform()}-${os.arch()}`
export const CURRENT_PLATFORM_SUPPORTED =
  SUPPORTED_PLATFORMS.includes(CURRENT_PLATFORM)

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

        textMapPropagator = new CompoundPropagator([
          new W3CBaggagePropagator(),
          new W3CTraceContextPropagator(),
        ])
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
}

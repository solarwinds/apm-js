import { NodeSDK } from "@opentelemetry/sdk-node"
import {
  type Sampler,
  type SpanExporter,
  ParentBasedSampler,
} from "@opentelemetry/sdk-trace-base"
import * as os from "os"

import { type SwoConfiguration, init } from "./config"
import { SwoExporter } from "./exporter"
import { SwoSampler } from "./sampler"

export const SUPPORTED_PLATFORMS = ["linux-arm64", "linux-x64"] as const
export const CURRENT_PLATFORM_SUPPORTED = (
  SUPPORTED_PLATFORMS as readonly string[]
).includes(`${os.platform()}-${os.arch()}`)

export class SwoSDK extends NodeSDK {
  constructor(config: SwoConfiguration) {
    let sampler: Sampler | undefined = undefined
    let traceExporter: SpanExporter | undefined = undefined

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
      } catch (error) {
        console.warn(
          "swo initialization failed, no traces will be collected. check your configuration to ensure it is correct.",
          error,
        )
      }
    } else {
      console.warn(
        "THE CURRENT PLATFORM IS NOT SUPPORTED; TRACE COLLECTION WILL BE DISABLED.",
        `supported platforms: ${SUPPORTED_PLATFORMS.join(", ")}`,
      )
    }

    super({
      ...config,
      sampler,
      traceExporter,
    })
  }
}

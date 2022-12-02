import { NodeSDK } from "@opentelemetry/sdk-node"
import * as os from "os"

import { type SwoConfiguration, init } from "./config"

export const SUPPORTED_PLATFORMS = ["linux-arm64", "linux-x64"] as const
export const CURRENT_PLATFORM_SUPPORTED = (
  SUPPORTED_PLATFORMS as readonly string[]
).includes(`${os.platform()}-${os.arch()}`)

export class SwoSDK extends NodeSDK {
  constructor(config: SwoConfiguration) {
    if (CURRENT_PLATFORM_SUPPORTED) {
      try {
        const _reporter = init(config)
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
    })
  }
}

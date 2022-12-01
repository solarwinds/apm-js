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
      const _reporter = init(config)
    } else {
      console.warn(
        "THE CURRENT PLATFORM IS NOT SUPPORTED; SUBMISSION WILL BE DISABLED.",
      )
      console.info(`supported platforms: ${SUPPORTED_PLATFORMS.join(", ")}`)
    }

    super({
      ...config,
    })
  }
}

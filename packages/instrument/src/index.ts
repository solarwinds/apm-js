import { context } from "@opentelemetry/api"
import * as sdk from "@swotel/sdk"

import { init } from "./init"

try {
  init("swo.config")
} catch (err) {
  console.warn(err)
}

export function setTransactionName(name: string): boolean {
  return sdk.setTransactionName(context.active(), name)
}
export function waitUntilAgentReady(timeout: number): number {
  return sdk.waitUntilAgentReady(timeout)
}

export { type ConfigFile } from "./config"

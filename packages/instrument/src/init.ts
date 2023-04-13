import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node"
import { SwoSDK } from "@swotel/sdk"

import { readConfig } from "./config"

export function init(configName: string) {
  /* eslint-disable-next-line ts/no-var-requires */
  const pkg = require("../package.json") as { name: string; version: string }
  const id = `${pkg.name}@${pkg.version}`
  const initSymbol = Symbol.for(`${id}/init`)

  if (!(initSymbol in globalThis)) {
    Object.defineProperty(globalThis, initSymbol, {
      value: true,
      writable: false,
      enumerable: false,
      configurable: false,
    })

    const config = readConfig(configName)

    const sdk = new SwoSDK({
      ...config,
      instrumentations: [getNodeAutoInstrumentations()],
    })
    sdk.start()
  }
}

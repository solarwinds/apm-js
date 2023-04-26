import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node"
import { SwoSDK } from "@swotel/sdk"

import { readConfig } from "./config"
import aoCert from "./appoptics.crt"

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

    if (config.collector?.includes("appoptics.com")) {
      config.metricFormat = 1

      if (!config.certificate) {
        config.certificate = aoCert
      }
    }

    const sdk = new SwoSDK({
      ...config,
      instrumentations: [getNodeAutoInstrumentations()],
    })
    sdk.start()
  }
}

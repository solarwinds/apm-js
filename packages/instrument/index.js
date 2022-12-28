try {
  const pkg = require("./package.json")
  const id = `${pkg.name}@${pkg.version}`
  const initSymbol = Symbol.for(`$${id}/init`)

  if (!globalThis[initSymbol]) {
    const fs = require("fs")
    const mc = require("@swotel/merged-config")
    const { SwoSDK } = require("@swotel/sdk")
    const {
      getNodeAutoInstrumentations,
    } = require("@opentelemetry/auto-instrumentations-node")

    // TODO: read a config file
    const config = mc.config(
      {
        serviceKey: { env: true, parser: String, required: true },
        collector: { env: true, parser: String },
        trustedPath: { env: true, parser: String },
      },
      {},
      "SW_APM_",
    )

    // TODO: AO cert
    if (config.trustedPath) {
      config.certificate = fs.readFileSync(config.trustedPath, {
        encoding: "utf8",
      })
    }

    const sdk = new SwoSDK({
      ...config,
      instrumentations: [getNodeAutoInstrumentations()],
    })
    sdk.start()

    Object.defineProperty(globalThis, initSymbol, {
      value: sdk,
      writable: false,
      enumerable: false,
      configurable: false,
    })
  }
} catch (err) {
  console.warn(err)
}

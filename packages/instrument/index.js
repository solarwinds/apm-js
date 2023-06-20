/*
Copyright 2023 SolarWinds Worldwide, LLC.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

try {
  const pkg = require("./package.json")
  const id = `${pkg.name}@${pkg.version}`
  const initSymbol = Symbol.for(`$${id}/init`)

  if (!globalThis[initSymbol]) {
    const fs = require("node:fs")
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

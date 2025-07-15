/*
Copyright 2023-2025 SolarWinds Worldwide, LLC.

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

import { register } from "node:module"

import { createAddHookMessageChannel } from "import-in-the-middle"

import { INIT } from "./commonjs/flags.js"
import log from "./commonjs/log.js"
import { environment } from "./env.js"
import { init } from "./init.js"
import {
  LOGGER_PROVIDER,
  METER_PROVIDER,
  SAMPLER,
  TRACER_PROVIDER,
} from "./shared/init.js"

const supported =
  environment.IS_SERVERLESS || (await import("./commonjs/version.js")).default
let initialised = Reflect.has(globalThis, INIT)

if (supported && !initialised) {
  try {
    Reflect.defineProperty(globalThis, INIT, {
      value: false,
      enumerable: false,
      configurable: true,
      writable: true,
    })

    const { registerOptions, waitForAllMessagesAcknowledged } =
      createAddHookMessageChannel()
    register("./hooks.js", import.meta.url, registerOptions)
    initialised = await init()
    await waitForAllMessagesAcknowledged()

    Reflect.defineProperty(globalThis, INIT, {
      value: true,
      enumerable: false,
      configurable: false,
      writable: false,
    })

    let exited = false
    Object.entries({
      SIGINT: 2,
      SIGTERM: 15,
      beforeExit: -128,
    }).map(([signal, code]) =>
      process.once(signal, () => {
        if (exited) return
        exited = true

        void Promise.all([TRACER_PROVIDER, METER_PROVIDER, LOGGER_PROVIDER])
          .then((providers) =>
            Promise.all(providers.map((provider) => provider?.shutdown())),
          )
          .finally(() => process.exit(128 + code))
      }),
    )
  } catch (error) {
    log(error)
  }
}

if (!initialised) {
  ;[SAMPLER, TRACER_PROVIDER, METER_PROVIDER, LOGGER_PROVIDER].map((c) => {
    c.resolve(undefined)
  })
}

export * from "./api.js"

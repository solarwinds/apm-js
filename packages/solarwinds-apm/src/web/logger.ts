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

import { type DiagLogFunction, type DiagLogger } from "@opentelemetry/api"

import { type Configuration } from "./config.js"

/** Web logger that makes use of the browser console */
export class Logger implements DiagLogger {
  readonly error = this.#makeLogger(console.error)
  readonly warn = this.#makeLogger(console.warn)
  readonly info = this.#makeLogger(console.info)
  readonly debug = this.#makeLogger(console.debug)
  readonly verbose = this.#makeLogger(console.debug)

  readonly #token?: string
  constructor(config: Configuration) {
    this.#token = config.token
  }

  #makeLogger(log: typeof console.log): DiagLogFunction {
    return (message, ...args) => {
      while (typeof args[0] === "string") {
        message += ` ${args.shift() as string}`
      }
      if (this.#token) {
        message = message.replaceAll(this.#token, "***")
      }
      log(message, ...args)
    }
  }
}

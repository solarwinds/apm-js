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

import * as process from "node:process"

import { type DiagLogFunction, type DiagLogger } from "@opentelemetry/api"
import stringify from "json-stringify-safe"

const HAS_COLOURS = process.stdout.isTTY && process.stdout.hasColors(16)
const COLOURS = {
  red: "\x1b[1;31m",
  yellow: "\x1b[1;33m",
  cyan: "\x1b[1;36m",
}

export class SwDiagLogger implements DiagLogger {
  readonly error = SwDiagLogger.makeLogger("error", "red")
  readonly warn = SwDiagLogger.makeLogger("warn", "yellow")
  readonly info = SwDiagLogger.makeLogger("info", "cyan")
  readonly debug = SwDiagLogger.makeLogger("debug")
  readonly verbose = SwDiagLogger.makeLogger("verbose")

  private static makeLogger(
    level: string,
    colour?: keyof typeof COLOURS,
  ): DiagLogFunction {
    if (HAS_COLOURS) {
      const colourCode = colour && COLOURS[colour]

      return (message, ...args) => {
        let line = `[${new Date().toISOString()}] (`

        if (colourCode) {
          line += colourCode
        }
        line += level.toUpperCase()
        if (colourCode) {
          line += "\x1b[0m"
        }

        line += `) ${message}`

        console.log(line, ...args)
      }
    } else {
      return (message, ...args) => {
        while (typeof args[0] === "string") {
          message += ` ${args.shift() as string}`
        }

        console.log(stringify({ time: new Date(), level, message, args }))
      }
    }
  }
}

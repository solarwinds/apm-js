/*
Copyright 2023-2024 SolarWinds Worldwide, LLC.

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

import process from "node:process"
import util from "node:util"

import { type DiagLogFunction, type DiagLogger } from "@opentelemetry/api"
import stringify from "json-stringify-safe"

const COLOURS = {
  red: "\x1b[1;31m",
  yellow: "\x1b[1;33m",
  cyan: "\x1b[1;36m",
}

export class Logger implements DiagLogger {
  readonly error = Logger.makeLogger("error", "red")
  readonly warn = Logger.makeLogger("warn", "yellow")
  readonly info = Logger.makeLogger("info", "cyan")
  readonly debug = Logger.makeLogger("debug")
  readonly verbose = Logger.makeLogger("verbose")

  private static makeLogger(
    level: string,
    colour?: keyof typeof COLOURS,
  ): DiagLogFunction {
    if (process.stdout.isTTY && process.stdout.hasColors(16)) {
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
        for (const arg of args) {
          const string = util.inspect(arg, false, Infinity, true)
          line += ` ${string}`
        }

        console.log(line)
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

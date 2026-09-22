/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import process from "node:process"
import util from "node:util"

import { type DiagLogFunction, type DiagLogger } from "@opentelemetry/api"
import stringify from "json-stringify-safe"

import { type Configuration } from "./config.ts"
import log from "./log.ts"

const COLOURS = {
	red: "\x1b[1;31m",
	yellow: "\x1b[1;33m",
	cyan: "\x1b[1;36m",
}

/** Node.js logger that outputs nice coloured messages in TTYs and JSON otherwise. */
export class Logger implements DiagLogger {
	readonly error = this.#makeLogger("error", "red", console.error)
	readonly warn = this.#makeLogger("warn", "yellow", console.warn)
	readonly info = this.#makeLogger("info", "cyan")
	readonly debug = this.#makeLogger("debug")
	readonly verbose = this.#makeLogger("verbose")

	readonly #token?: string
	constructor(config: Configuration) {
		this.#token = config.token
	}

	#makeLogger(
		level: string,
		colour?: keyof typeof COLOURS,
		pretty: typeof console.log = console.log,
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
					const string = typeof arg === "string" ? arg : util.inspect(arg, false, 4, true)
					line += ` ${string}`
				}

				pretty(this.#redact(line))
			}
		} else {
			return (message, ...args) => {
				while (typeof args[0] === "string") {
					message += ` ${args.shift() as string}`
				}

				log(this.#redact(stringify({ time: new Date(), level, message, args })))
			}
		}
	}

	#redact(line: string) {
		if (this.#token) {
			return line.replaceAll(this.#token, "***")
		} else {
			return line
		}
	}
}

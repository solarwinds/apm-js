/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { type DiagLogFunction, type DiagLogger } from "@opentelemetry/api"

import { type Configuration } from "./config.ts"

/** Web logger that makes use of the browser console. */
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

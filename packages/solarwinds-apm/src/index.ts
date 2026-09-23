/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { createRequire, register } from "node:module"

import { createAddHookMessageChannel } from "import-in-the-middle"

import { environment } from "./env.ts"
import { INIT } from "./flags.ts"
import { init, initNoop } from "./init.ts"
import log from "./log.ts"

const supportedCheck = () => {
	const require = createRequire(import.meta.url)
	try {
		return require("./version.cjs") as boolean
	} catch {
		return false
	}
}

const supported = environment.IS_SERVERLESS || supportedCheck()
let initialised = Reflect.has(globalThis, INIT)

if (supported && !initialised) {
	try {
		Reflect.defineProperty(globalThis, INIT, {
			value: false,
			enumerable: false,
			configurable: true,
			writable: true,
		})

		const { registerOptions, waitForAllMessagesAcknowledged } = createAddHookMessageChannel()
		// oxlint-disable-next-line typescript/no-deprecated
		register("../hook.mjs", import.meta.url, registerOptions)
		initialised = init()
		// TODO: this is the last bit of async code
		await waitForAllMessagesAcknowledged()

		Reflect.defineProperty(globalThis, INIT, {
			value: true,
			enumerable: false,
			configurable: false,
			writable: false,
		})
	} catch (error) {
		log(error)
	}
}

if (!initialised) {
	initNoop()
}

export * from "./api.ts"

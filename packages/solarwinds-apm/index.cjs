/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

"use strict"

/** @type {import("./src/api.ts")} */
module.exports = {
	forceFlush() {
		return Promise.resolve()
	},
	setTransactionName(_name) {
		return false
	},
	waitUntilReady() {
		return Promise.resolve(false)
	},
}

let supported
try {
	supported = require("./dist/version.cjs")
} catch (_error) {
	supported = false
}

if (supported) {
	const { register } = require("node:module")
	const { pathToFileURL } = require("node:url")
	const log = require("./dist/log.mjs")
	const { INIT } = require("./dist/flags.mjs")
	const { init, initNoop } = require("./dist/init.mjs")

	let initialised = Reflect.has(globalThis, INIT)
	if (!initialised) {
		try {
			Reflect.defineProperty(globalThis, INIT, {
				value: false,
				enumerable: false,
				configurable: true,
				writable: true,
			})

			register("./hook.mjs", pathToFileURL(__filename))
			initialised = init()

			Reflect.defineProperty(globalThis, INIT, {
				value: true,
				enumerable: false,
				configurable: false,
				writable: false,
			})

			module.exports = require("./dist/api.mjs")
		} catch (error) {
			log(error)
		}
	}

	if (!initialised) {
		initNoop()
	}
}

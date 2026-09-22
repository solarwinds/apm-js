/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

"use strict"

let supported
try {
	supported = require("./dist/version.cjs")
} catch (_error) {
	supported = false
}

if (supported) {
	const log = require("./dist/log.mjs")

	try {
		const { register } = require("node:module")
		const { pathToFileURL } = require("node:url")
		const { INIT } = require("./dist/flags.mjs")
		const { init } = require("./dist/init.mjs")

		let initialised = Reflect.has(globalThis, INIT)
		if (!initialised) {
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
		}

		module.exports = require("./dist/api.mjs")
	} catch (error) {
		log(error)
	}
} else {
	// NOOP
	module.exports = {
		forceFlush() {
			return Promise.resolve()
		},
		setTransactionName(_name) {
			return true
		},
		waitUntilReady() {
			return Promise.resolve(true)
		},
	}
}

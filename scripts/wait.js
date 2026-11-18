/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { setTimeout as sleep } from "node:timers/promises"
import { parseArgs } from "node:util"

import meta from "../packages/solarwinds-apm/package.json" with { type: "json" }

const {
	values,
	positionals: [version = meta.version],
} = parseArgs({
	allowPositionals: true,
	options: {
		timeout: { type: "string", default: "3600" },
		interval: { type: "string", default: "60" },
	},
})
const timeout = Number(values.timeout)
const interval = Number(values.interval)

const spec = `solarwinds-apm@${version}`
const url = `https://registry.npmjs.org/solarwinds-apm/-/solarwinds-apm-${encodeURIComponent(version)}.tgz`
const deadline = performance.now() + timeout * 1000
let available = false
console.log(`waiting up to ${timeout}s for npm tarball: ${spec}`)

/* oxlint-disable no-await-in-loop */
while (performance.now() < deadline) {
	let remaining = deadline - performance.now()
	try {
		const response = await fetch(url, {
			headers: { "Cache-Control": "no-cache" },
			signal: AbortSignal.timeout(Math.min(1000, remaining)),
		})
		await response.body?.cancel()
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`)
		}

		available = true
		console.log(`${spec}: tarball available`)
		break
	} catch (error) {
		console.log(`${spec}: ${error.message}`)
	}

	remaining = deadline - performance.now()
	if (remaining <= 0) break
	await sleep(Math.min(interval * 1000, remaining))
}
/* oxlint-enable no-await-in-loop */

if (!available) {
	throw new Error(`timed out after ${timeout}s waiting for npm tarball: ${spec}`)
}

/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import fs from "fs"
import path from "path"

import instrumentation from "@opentelemetry/instrumentation/package.json" with { type: "json" }
import releases from "node-releases/data/release-schedule/release-schedule.json" with { type: "json" }
import satisfies from "semver/functions/satisfies.js"

import meta from "../package.json" with { type: "json" }
import log from "./log.ts"
import RELEASED from "./timestamp.ts"

const NOW = Date.now()
const YEAR = 1000 * 60 * 60 * 24 * 365

let supported = true
for (const major in releases) {
	if (!process.version.startsWith(major)) {
		continue
	}

	const release = releases[major as keyof typeof releases]
	const lts = "lts" in release
	const eol = new Date(release.end).valueOf()

	const maintained = NOW - eol <= 0
	if (!maintained) {
		log(
			"The detected Node.js version (" +
				process.version +
				") has reached End Of Life (" +
				release.end +
				").",
		)
		log(
			"SolarWinds STRONGLY recommends customers use a non-EOL Node.js version receiving security updates.",
		)
	}

	supported = RELEASED - eol <= (lts ? YEAR : 0)
}

if (supported) {
	supported = satisfies(process.version.substring(1), meta.engines.node)
}
if (!supported) {
	log(
		"The detected Node.js version (" +
			process.version +
			") is not supported by the SolarWinds instrumentation library (" +
			meta.engines.node +
			").",
	)
	log("The application will not be instrumented to avoid potential compatibility issues.")
}

function logVersion(module: string) {
	let dir = require.resolve(module)
	while (!dir.endsWith(module)) {
		dir = path.dirname(dir)
	}

	const meta = JSON.parse(
		fs.readFileSync(path.join(dir, "package.json"), {
			encoding: "utf8",
		}),
	) as { version: string }
	log(`${module} ${meta.version}`)
}

log(`solarwinds-apm ${meta.version}`)
try {
	logVersion("@opentelemetry/api")
	logVersion("@opentelemetry/core")
	log(`@opentelemetry/instrumentation ${instrumentation.version}`)
} catch (error) {
	log(error)
}

export default supported

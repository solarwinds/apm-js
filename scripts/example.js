/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import "dotenv/config"

import { execSync } from "node:child_process"
import { parseArgs } from "node:util"

const {
	values: { collector, proxy },
	positionals: [example],
} = parseArgs({
	allowPositionals: true,
	options: {
		collector: { short: "c", type: "boolean", default: false },
		proxy: { short: "p", type: "boolean", default: false },
	},
})

function exec(cmd) {
	console.log(`$ ${cmd}`)
	return execSync(cmd, { stdio: "inherit" })
}

exec(`nx run-many -t build -p solarwinds-apm,@solarwinds-apm/example-${example}`)

if (collector) {
	process.env.OTEL_EXPORTER_OTLP_ENDPOINT = proxy
		? "http://collector:4318"
		: "http://localhost:4318"
}
if (proxy) {
	process.env.SW_APM_PROXY = "http://localhost:3128"
}

process.on("SIGINT", () => {
	process.exit(0)
})

try {
	exec("docker compose -f docker/docker-compose.yml up -d --wait")
	exec(`pnpm -F @solarwinds-apm/example-${example} start`)
} catch (error) {
	if (error.signal !== "SIGINT") {
		throw error
	}
} finally {
	exec("docker compose -f docker/docker-compose.yml down")
}

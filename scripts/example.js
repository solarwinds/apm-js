/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import "dotenv/config"

import { execSync } from "node:child_process"
import process from "node:process"

const example = process.argv[2]
const collector = process.argv.slice(3).includes("collector")
const proxy = process.argv.slice(3).includes("proxy")

function exec(cmd) {
	return execSync(cmd, { stdio: "inherit" })
}

// build example and its deps outside of the container
exec(`nx run-many -t build -p solarwinds-apm,@solarwinds-apm/example-${example}`)

// get env vars that will be passed to the container
const env = Object.fromEntries(
	Object.entries(process.env).filter(
		([key]) =>
			key.startsWith("SW_APM_") || key.startsWith("OTEL_") || key.startsWith("AWS_LAMBDA_"),
	),
)
if (collector) {
	env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://otel-collector:4318"
}
if (proxy) {
	env.SW_APM_PROXY = "http://proxy:3128"
}

// run example inside container
const dockerEnv = Object.entries(env)
	.map(([k, v]) => `-e ${k}=${v}`)
	.join(" ")
exec(
	`docker compose -f docker/docker-compose.yml run ${dockerEnv} -e PORT=8080 -p 8080:8080 --rm example 'pnpm install && cd ./examples/${example} && (pnpm start || true)'; pnpm install`,
)

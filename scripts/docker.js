/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import "dotenv/config"

import { execSync } from "node:child_process"
import process from "node:process"

function exec(cmd) {
	return execSync(cmd, { stdio: "inherit" })
}

const image = process.argv[2]
const shell = image.includes("alpine") ? "/bin/sh" : "/bin/bash"

if (!image) {
	throw new Error("No image specified")
}

if (image === "collector") {
	exec("docker compose -f docker/docker-compose.yml logs --since 2m -f otel-collector udpdump")
} else if (image === "proxy") {
	exec("docker compose -f docker/docker-compose.yml logs --since 2m -f proxy")
} else if (image === "logs") {
	exec("docker compose -f docker/docker-compose.yml logs")
} else if (image === "down") {
	exec("docker compose -f docker/docker-compose.yml down")
} else if (process.argv[3] === "build") {
	exec(`docker compose -f docker/docker-compose.yml build ${image}`)
} else {
	await import("dotenv/config")
	const env = Object.entries(process.env)
		.filter(
			([key]) =>
				key.startsWith("SW_APM_") || key.startsWith("OTEL_") || key.startsWith("AWS_LAMBDA_"),
		)
		.map(([k, v]) => `-e ${k}=${v}`)
		.join(" ")

	// first run pnpm install in the context of the container so that platform specific modules get installed
	// then start a shell session with `|| true` so that if the last ran command in the shell errors node doesn't throw
	// finally run pnpm install back on the host to reset the platform specific modules
	exec(
		`docker compose -f docker/docker-compose.yml run ${env} --rm ${image} '(pnpm install) && (${shell} || true)'; pnpm install`,
	)
}

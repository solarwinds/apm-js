/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import fs from "node:fs/promises"

import instrumentation from "@opentelemetry/instrumentation/package.json" with { type: "json" }
import base from "@solarwinds-apm/configs/tsdown"
import { minVersion, compare } from "semver"
import { build } from "tsdown"

function stricterRange(...ranges: string[]): string {
	const options = ranges
		.map((range) => ({ range, min: minVersion(range) }))
		.filter(({ min }) => min)
	options.sort((a, b) => compare(b.min!, a.min!))
	return options[0]!.range
}

async function updateDependencies() {
	const DEPS = ["import-in-the-middle", "require-in-the-middle"] as const

	const pkg = JSON.parse(await fs.readFile("package.json", { encoding: "utf-8" })) as {
		dependencies: Record<string, string>
	}
	for (const dep of DEPS) {
		const selfRange = pkg.dependencies[dep]!
		const otelRange = instrumentation.dependencies[dep]
		pkg.dependencies[dep] = stricterRange(selfRange, otelRange)
	}
	await fs.writeFile("package.json", JSON.stringify(pkg))
}

async function runBuild() {
	// Write timestamp file
	await fs.writeFile("src/timestamp.ts", `export default ${Date.now()}`)

	const { target, ...config } = base
	await build({
		...config,
		target: [target as string, "baseline-widely-available"],
		format: {
			esm: {
				entry: {
					index: "./src/index.ts",
					init: "./src/init.ts",
					api: "./src/api.ts",
					log: "./src/log.ts",
					flags: "./src/flags.ts",
					web: "./src/web/index.ts",
				},
			},
			cjs: {
				entry: {
					version: "./src/version.ts",
				},
				dts: false,
			},
		},
		exports: false,
	})
}

await updateDependencies()
await runBuild()

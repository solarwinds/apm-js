/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { exec } from "node:child_process"
import { parseArgs, promisify } from "node:util"

const {
	values: { json },
} = parseArgs({
	options: {
		json: { type: "boolean", default: false },
	},
})

async function execJson(cmd) {
	const { stdout } = await promisify(exec)(cmd)
	return JSON.parse(stdout)
}

const globs = []
const expanded = []
const projects = await execJson("pnpm nx show projects --with-target build --json")

const outputs = await Promise.all(
	projects.map((project) => execJson(`pnpm nx show target outputs ${project}:build --json`)),
)
for (const { outputPaths, expandedOutputs } of outputs) {
	globs.push(...outputPaths)
	if (expandedOutputs) {
		expanded.push(...expandedOutputs)
	}
}

if (json) {
	console.log(JSON.stringify({ globs, expanded }, null, "\t"))
} else {
	console.log(globs.join("\n"))
}

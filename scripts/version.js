/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { parseArgs } from "node:util"

const {
	values: { "dry-run": DRY_RUN },
} = parseArgs({ options: { "dry-run": { type: "boolean" } } })

function exec(cmd, opts = {}, safe = false) {
	console.log(`$ ${cmd}`)
	if (safe || !DRY_RUN) {
		return execSync(cmd, { stdio: "inherit", ...opts })
	} else {
		return Buffer.alloc(0)
	}
}

function readJson(path) {
	return JSON.parse(readFileSync(path, { encoding: "utf-8" }))
}

const status = exec("git status --porcelain", { stdio: "pipe" }, true).toString("utf-8")
const files = status
	.split("\n")
	.map((line) => line.trim())
	.filter((line) => line.length > 0)
	.map((line) => {
		const [mode, ...file] = line.split(" ")
		return { mode: mode.trim(), file: file.join(" ").trim() }
	})
const bumped = files
	.filter(({ file }) => /packages\/[^/]+\/package.json/.test(file))
	.map(({ file }) => readJson(file))

const commitMessage = bumped
	.map(({ name, version }) => `${name} ${version}`)
	.toSorted()
	.join(", ")
exec("git add .")
exec(`git commit -m 'version bump' -m '${commitMessage}'`)

for (const { name, version } of bumped) {
	const tag =
		name === "solarwinds-apm"
			? `v${version}`
			: `${name.replace("@solarwinds-apm/", "")}-v${version}`
	const message = `${name} ${version}`
	exec(`git tag -a '${tag}' -m '${message}'`)
}

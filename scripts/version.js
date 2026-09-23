/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"
import process from "node:process"

function exec(cmd, opts = {}) {
	console.log(`$ ${cmd}`)
	return execSync(cmd, { stdio: "inherit", ...opts })
}

function readJson(path) {
	return JSON.parse(readFileSync(path, { encoding: "utf-8" }))
}

function gitStatus() {
	const output = exec("git status --porcelain", { stdio: "pipe" }).toString("utf-8")
	const files = output
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.map((line) => {
			const [mode, ...file] = line.split(" ")
			return { mode: mode.trim(), file: file.join(" ").trim() }
		})
	return files
}

const status = gitStatus()
if (status.length > 0) {
	throw new Error("commit all changes before bumping versions", {
		cause: status,
	})
}

let command = "yarn version apply --all"
if (process.argv[2] === "pre") {
	command += " --prerelease='pre.%n'"
}

exec(command)
exec("oxfmt 'packages/*/package.json'")

exec("git add yarn.lock .yarn 'packages/**/package.json'")

const bumped = gitStatus()
	.filter(({ file }) => /packages\/[^/]+\/package.json/.test(file))
	.map(({ file }) => readJson(file))

const commitMessage = bumped
	.map(({ name, version }) => `${name} ${version}`)
	.toSorted()
	.join(", ")
exec(`git commit -m 'version bump' -m '${commitMessage}'`)

for (const { name, version } of bumped) {
	const tag =
		name === "solarwinds-apm"
			? `v${version}`
			: `${name.replace("@solarwinds-apm/", "")}-v${version}`
	const message = `${name} ${version}`
	exec(`git tag -a '${tag}' -m '${message}'`)
}

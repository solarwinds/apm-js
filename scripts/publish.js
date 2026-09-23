/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"
import process from "node:process"

const { name, version } = JSON.parse(readFileSync("package.json", { encoding: "utf-8" }))

let publishedVersions
try {
	const info = JSON.parse(execSync(`pnpm view ${name} --json`).toString("utf-8"))
	publishedVersions = info.versions
} catch {
	publishedVersions = []
}

if (publishedVersions.includes(version)) {
	console.log(`${name}@${version} is already published`)
	process.exit()
}

let command = "pnpm publish"
if (version.includes("pre")) {
	command += " --tag prerelease"
}
execSync(command, { stdio: "inherit" })

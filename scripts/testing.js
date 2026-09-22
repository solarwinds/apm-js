/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { execSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"

const now = new Date()
const parts = {
	year: now.getUTCFullYear(),
	month: now.getUTCMonth(),
	day: now.getUTCDate(),
	hours: now.getUTCHours(),
	minutes: now.getUTCMinutes(),
}
const version = `${parts.year}.${parts.month}.${parts.day}-t.${parts.hours}.${parts.minutes}`

const setVersion = (packageJsonPath) => {
	const packageJson = JSON.parse(readFileSync(packageJsonPath, { encoding: "utf-8" }))
	packageJson.version = version
	writeFileSync(packageJsonPath, JSON.stringify(packageJson))
	execSync(`prettier --write ${packageJsonPath}`, { stdio: "inherit" })
}

const packages = readdirSync("packages")
for (const p of packages) {
	const packagePath = path.join("packages", p)
	if (!statSync(packagePath).isDirectory()) continue

	setVersion(path.join(packagePath, "package.json"))

	const npmPath = path.join(packagePath, "npm")
	if (existsSync(npmPath)) {
		const npmPackages = readdirSync(npmPath)
		for (const np of npmPackages) {
			setVersion(path.join(npmPath, np, "package.json"))
		}
	}
}

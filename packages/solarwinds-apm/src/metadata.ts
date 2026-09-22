/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import process from "node:process"

import { type Attributes } from "@opentelemetry/api"
import { dependencies } from "@solarwinds-apm/dependencies"
import semver from "semver"

/** Versions of the dependencies of Node.js itself. */
export const VERSIONS: Attributes = Object.fromEntries(
	Object.entries(process.versions)
		.filter(([name]) => name !== "node")
		.map(([name, version]) => [`nodejs.${name}.version`, version]),
)

/** Versions of the dependencies available to the Node.js process. */
export async function modules(): Promise<Attributes> {
	const modules = await dependencies()
	return Object.fromEntries(
		[...modules].map(([name, versions]) => [
			`node_modules.${name}.versions`,
			[...versions].toSorted(semver.compare),
		]),
	)
}

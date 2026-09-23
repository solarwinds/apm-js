/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import fs from "node:fs/promises"
import path from "node:path"

import { type Dependencies, type Package } from "./index.ts"

interface PackageLocator {
	name: string
	reference: string
}
interface PackageInformation {
	packageLocation: string
}

interface StdPnpApi {
	VERSIONS: {
		std: number
	}
	getPackageInformation(locator: PackageLocator): PackageInformation
}
interface YarnPnpApi extends StdPnpApi {
	VERSIONS: { getAllLocators: number } & StdPnpApi["VERSIONS"]
	getAllLocators(): PackageLocator[]
}
export type PnpApi = StdPnpApi | YarnPnpApi

export function collectPnpApiDependencies(dependencies: Dependencies, pnp: YarnPnpApi) {
	const tasks = pnp.getAllLocators().map(async (locator) => {
		const { packageLocation } = pnp.getPackageInformation(locator)
		const packagePath = path.join(packageLocation, "package.json")

		try {
			const packageJson = await fs.readFile(packagePath, { encoding: "utf-8" })
			const { name, version } = JSON.parse(packageJson) as Package
			dependencies.add(name, version)
		} catch {
			return
		}
	})

	return Promise.all(tasks)
}

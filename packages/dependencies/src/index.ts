/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { collectNodeModulesDependencies } from "./node-modules.ts"
import { collectPnpApiDependencies, type PnpApi } from "./pnp-api.ts"

const PNP = "pnpapi"

export class Dependencies {
	private readonly dependencies = new Map<string, Set<string>>()

	add(name: string, version: string): void {
		const versions = this.dependencies.get(name)
		if (versions) {
			versions.add(version)
		} else {
			this.dependencies.set(name, new Set([version]))
		}
	}

	has(name: string): boolean {
		return this.dependencies.has(name)
	}

	names(): IterableIterator<string> {
		return this.dependencies.keys()
	}

	versions(name: string): Set<string> | undefined {
		return this.dependencies.get(name)
	}

	[Symbol.iterator]() {
		return this.dependencies.entries()
	}
}

export interface Package {
	name: string
	version: string
}

export async function dependencies(): Promise<Dependencies> {
	const pnp = await import(PNP).then((pnp) => pnp as PnpApi).catch(() => undefined)

	const dependencies = new Dependencies()

	if (pnp && "getAllLocators" in pnp && pnp.VERSIONS.getAllLocators === 1) {
		// Yarn >= 2 PnP-based environment
		await collectPnpApiDependencies(dependencies, pnp)
	} else {
		// Other node_modules-based environment
		await collectNodeModulesDependencies(dependencies)
	}

	return dependencies
}

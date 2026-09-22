/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { type Dirent, promises as fs } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"

import { type Dependencies, type Package } from "./index.ts"

export function collectNodeModulesDependencies(dependencies: Dependencies) {
	// node_modules is not a real package we just want all the paths looked up by
	// package resolution
	const roots = createRequire(import.meta.url).resolve.paths("node_modules") ?? []
	const tasks = roots.map((root) => collectRoot(dependencies, root))
	return Promise.all(tasks)
}

async function collectRoot(dependencies: Dependencies, root: string) {
	let entries: Dirent[]
	try {
		entries = await fs.readdir(root, { withFileTypes: true })
	} catch {
		return
	}

	const tasks = entries.map(async (entry) => {
		const entryPath = path.join(root, entry.name)
		const stats = await fs.stat(entryPath)

		// Skip files and hidden directories
		if (!stats.isDirectory() || entry.name.startsWith(".")) {
			return
		}

		// Scoped packages are nested under a directory named after the scope
		if (entry.name.startsWith("@")) {
			await collectRoot(dependencies, entryPath)
			return
		}

		const packagePath = path.join(entryPath, "package.json")

		try {
			const packageJson = await fs.readFile(packagePath, { encoding: "utf-8" })
			const { name, version } = JSON.parse(packageJson) as Package
			dependencies.add(name, version)
		} catch {
			return
		}

		// Packages may have a nested node_modules if they require a different
		// version of a dependency than the root package
		const nodeModulesPath = path.join(entryPath, "node_modules")
		await collectRoot(dependencies, nodeModulesPath)
	})

	await Promise.allSettled(tasks)
}

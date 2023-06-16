import * as fs from "node:fs"
import * as path from "node:path"

import { type Dependencies, type Package } from "."

export function collectNodeModulesDependencies(dependencies: Dependencies) {
  const roots = require.resolve.paths("node_modules") ?? []
  for (const root of roots) {
    collectRoot(dependencies, root)
  }
}

function collectRoot(dependencies: Dependencies, root: string) {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(root, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    const entryPath = path.join(root, entry.name)
    const stats = fs.statSync(entryPath, { throwIfNoEntry: false })
    if (!stats?.isDirectory() || entry.name.startsWith(".")) {
      continue
    }

    if (entry.name.startsWith("@")) {
      collectRoot(dependencies, entryPath)
      continue
    }

    try {
      const packagePath = path.join(entryPath, "package.json")
      // eslint-disable-next-line ts/no-var-requires
      const { name, version } = require(packagePath) as Package
      dependencies.add(name, version)

      const nodeModulesPath = path.join(entryPath, "node_modules")
      collectRoot(dependencies, nodeModulesPath)
    } catch {
      continue
    }
  }
}

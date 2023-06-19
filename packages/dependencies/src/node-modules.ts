import * as fs from "node:fs"
import * as path from "node:path"

import { type Dependencies, type Package } from "."

export function collectNodeModulesDependencies(dependencies: Dependencies) {
  // node_modules is not a real package we just want all the paths looked up by
  // package resolution
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
    // Skip files and hidden directories
    if (!stats?.isDirectory() || entry.name.startsWith(".")) {
      continue
    }

    // Scoped packages are nested under a directory named after the scope
    if (entry.name.startsWith("@")) {
      collectRoot(dependencies, entryPath)
      continue
    }

    try {
      const packagePath = path.join(entryPath, "package.json")
      // eslint-disable-next-line ts/no-var-requires
      const { name, version } = require(packagePath) as Package
      dependencies.add(name, version)

      // Packages may have a nested node_modules if they require a different
      // version of a dependency than the root package
      const nodeModulesPath = path.join(entryPath, "node_modules")
      collectRoot(dependencies, nodeModulesPath)
    } catch {
      continue
    }
  }
}

/*
Copyright 2023 SolarWinds Worldwide, LLC.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { type Dirent, promises as fs } from "node:fs"
import { createRequire } from "node:module"
import * as path from "node:path"

import { callsite } from "@solarwinds-apm/module"

import { type Dependencies, type Package } from "."

export function collectNodeModulesDependencies(dependencies: Dependencies) {
  // node_modules is not a real package we just want all the paths looked up by
  // package resolution
  const roots =
    createRequire(callsite().getFileName()!).resolve.paths("node_modules") ?? []
  const tasks = roots.map((root) => collectRoot(dependencies, root))
  return Promise.allSettled(tasks)
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
    const packageJson = await fs.readFile(packagePath, { encoding: "utf-8" })
    const { name, version } = JSON.parse(packageJson) as Package
    dependencies.add(name, version)

    // Packages may have a nested node_modules if they require a different
    // version of a dependency than the root package
    const nodeModulesPath = path.join(entryPath, "node_modules")
    await collectRoot(dependencies, nodeModulesPath)
  })

  await Promise.allSettled(tasks)
}

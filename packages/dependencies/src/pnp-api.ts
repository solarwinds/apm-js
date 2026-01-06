/*
Copyright 2023-2026 SolarWinds Worldwide, LLC.

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

import fs from "node:fs/promises"
import path from "node:path"

import { type Dependencies, type Package } from "./index.js"

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

export function collectPnpApiDependencies(
  dependencies: Dependencies,
  pnp: YarnPnpApi,
) {
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

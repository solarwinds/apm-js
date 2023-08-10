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

import * as path from "node:path"

import { type Dependencies, type Package } from "."

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
  for (const locator of pnp.getAllLocators()) {
    const { packageLocation } = pnp.getPackageInformation(locator)

    try {
      const packagePath = path.join(packageLocation, "package.json")
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { name, version } = require(packagePath) as Package
      dependencies.add(name, version)
    } catch {
      continue
    }
  }
}

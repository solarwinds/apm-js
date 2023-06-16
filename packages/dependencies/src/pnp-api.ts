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
      // eslint-disable-next-line ts/no-var-requires
      const { name, version } = require(packagePath) as Package
      dependencies.add(name, version)
    } catch {
      continue
    }
  }
}

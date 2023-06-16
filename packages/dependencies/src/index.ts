import { collectNodeModulesDependencies } from "./node-modules"
import { collectPnpApiDependencies, type PnpApi } from "./pnp-api"

let pnpApi: PnpApi | undefined
try {
  // eslint-disable-next-line
  pnpApi = require("pnpapi")
} catch {
  pnpApi = undefined
}

export class Dependencies {
  private readonly dependencies = new Map<string, Set<string>>()

  add(name: string, version: string) {
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

export function dependencies(pnp: PnpApi | undefined = pnpApi): Dependencies {
  const dependencies = new Dependencies()

  if (pnp && "getAllLocators" in pnp && pnp.VERSIONS.getAllLocators === 1) {
    collectPnpApiDependencies(dependencies, pnp)
  } else {
    collectNodeModulesDependencies(dependencies)
  }

  return dependencies
}

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
    // Yarn >= 2 PnP-based environment
    collectPnpApiDependencies(dependencies, pnp)
  } else {
    // Other node_modules-based environment
    collectNodeModulesDependencies(dependencies)
  }

  return dependencies
}

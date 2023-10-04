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

const PNP = "pnpapi"

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

export async function dependencies(): Promise<Dependencies> {
  const pnp = await import(PNP)
    .then((pnp) => pnp as PnpApi)
    .catch(() => undefined)

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

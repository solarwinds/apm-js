/*
Copyright 2023-2024 SolarWinds Worldwide, LLC.

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
import process from "node:process"

import { type Attributes } from "@opentelemetry/api"
import { dependencies } from "@solarwinds-apm/dependencies"
import semver from "semver"

let version: string
try {
  const json = await fs.readFile("../package.json", { encoding: "utf-8" })
  const parsed = JSON.parse(json) as Record<string, unknown>
  if (typeof parsed.version === "string") {
    version = parsed.version
  } else {
    // Should never happen
    version = null!
  }
} catch {
  // Should also never happen
  version = null!
}
export const VERSION = version

/**
 * Versions of the dependencies of Node.js itself
 */
export const VERSIONS: Attributes = Object.fromEntries(
  Object.entries(process.versions)
    .filter(([name]) => name !== "node")
    .map(([name, version]) => [`node.${name}.version`, version]),
)

/**
 * Versions of the dependencies available to the Node.js process
 */
export async function modules(): Promise<Attributes> {
  const modules = await dependencies()
  return Object.fromEntries(
    [...modules].map(([name, versions]) => [
      `node.${name}.versions`,
      [...versions].sort(semver.compare),
    ]),
  )
}

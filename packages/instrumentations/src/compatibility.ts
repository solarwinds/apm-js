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

import { writeFile } from "node:fs/promises"
import { exit } from "node:process"

import {
  type InstrumentationBase,
  type InstrumentationModuleDefinition,
} from "@opentelemetry/instrumentation"
import { format } from "prettier"
import { type Comparator, compare, minVersion, Range } from "semver"

import { getInstrumentations } from "./index.js"

const instrumentations = getInstrumentations() as InstrumentationBase[]

const init = "init" as const
const definitions = instrumentations
  .flatMap((i) => i[init]())
  .filter((d): d is InstrumentationModuleDefinition<unknown> => !!d)

const versions = new Map<string, Set<string>>()
for (const d of definitions) {
  const supported = versions.get(d.name) ?? new Set()
  for (const v of d.supportedVersions) {
    supported.add(v)
  }
  versions.set(d.name, supported)
}

const ranges = [...versions].map(([name, versions]) => ({
  name,
  range: new Range([...versions].join("||")),
}))

// whether the range consists of a lower inclusive bound and an optional upper exclusive bound
const isStandardRange = (
  comparators: readonly Comparator[],
): comparators is readonly [Comparator] | readonly [Comparator, Comparator] =>
  (comparators.length === 1 && comparators[0]!.operator === ">=") ||
  (comparators.length === 2 &&
    comparators[0]!.operator === ">=" &&
    comparators[1]!.operator === "<")

for (const { range } of ranges) {
  // comparators to remove from the set after this operation
  const filter = new WeakSet<readonly Comparator[]>()
  // previous comparator if it was a bounded standard range
  let previous: readonly [Comparator, Comparator] | undefined = undefined

  // update comparator values for proper formatting
  const update = (comparator: Comparator) => {
    comparator.value = comparator.operator + comparator.semver.version
  }
  // remove artificial -0 prerelease tags created by semver library
  const cleanup = (comparator: Comparator) => {
    if (
      comparator.operator === "<" &&
      comparator.semver.prerelease.length === 1 &&
      comparator.semver.prerelease[0] === 0
    ) {
      comparator.semver.prerelease = []
      comparator.semver.format()
      update(comparator)
    }
  }

  // sort the set of ranges in ascending number based on their lower bound
  range.set = [...range.set].sort((a, b) =>
    compare(minVersion(a.join(" "))!, minVersion(b.join(" "))!),
  )

  for (const comparators of range.set) {
    comparators.forEach(cleanup)

    if (!isStandardRange(comparators)) {
      previous = undefined
      continue
    }

    if (previous) {
      const [currentLower] = comparators
      const [previousLower, previousUpper] = previous

      // if our lower bound is the same as the previous upper bound
      // merge the two ranges into a single one
      if (compare(previousUpper.semver, currentLower.semver) === 0) {
        filter.add(previous)
        currentLower.semver = previousLower.semver
        update(currentLower)
      }
    }

    previous = comparators.length === 2 ? comparators : undefined
  }

  range.set = range.set.filter((comparators) => !filter.has(comparators))
}

const supported = ranges
  .map(({ name, range }) => ({
    name,
    versions: range.set
      .map((comparators) => comparators.join(" "))
      .join(" || ")
      .replace(/^$/, "*"),
  }))
  .sort((a, b) => a.name.localeCompare(b.name))

const table = supported
  .map(
    ({ name, versions }) =>
      `| \`${name}\` | \`${versions.replaceAll("|", "\\|")}\` |`,
  )
  .join("\n")
const md = `
# Module Compatibility

| Name | Versions |
| ---- | -------- |
${table}
`

format(md, { parser: "markdown" })
  .then((md) => writeFile("./COMPATIBILITY.md", md))
  .catch((err) => {
    console.error(err)
    exit(1)
  })

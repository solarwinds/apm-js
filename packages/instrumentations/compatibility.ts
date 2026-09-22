/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { writeFile } from "node:fs/promises"

import { type InstrumentationBase } from "@opentelemetry/instrumentation"
import { type Comparator, compare, minVersion, Range } from "semver"

import { getInstrumentations } from "./src/index.ts"

const PLUGIN_META = Symbol.for("plugin-meta")
interface Instrumentation extends InstrumentationBase {
	plugin?(): {
		[PLUGIN_META]: { fastify: string }
	}
}

const instrumentations = getInstrumentations({}, "all") as Instrumentation[]

const versions = new Map<string, { versions: Set<string>; instrumentation: string }>()

for (const i of instrumentations) {
	const instrumentation = i.instrumentationName

	const definitions = i.getModuleDefinitions()
	for (const definition of definitions) {
		const supported = versions.get(definition.name) ?? {
			versions: new Set(),
			instrumentation,
		}
		for (const v of definition.supportedVersions) {
			supported.versions.add(v)
		}
		versions.set(definition.name, supported)
	}

	const plugin = i.plugin?.()
	if (plugin) {
		const supported = versions.get("fastify") ?? {
			versions: new Set(),
			instrumentation,
		}
		supported.versions.add(plugin[PLUGIN_META].fastify)
		versions.set("fastify", supported)
	}
}

const ranges = [...versions].map(([name, { versions, instrumentation }]) => ({
	name,
	range: new Range([...versions].join("||")),
	instrumentation,
}))

// whether the range consists of a lower inclusive bound and an optional upper exclusive bound
const isStandardRange = (
	comparators: readonly Comparator[],
): comparators is readonly [Comparator] | readonly [Comparator, Comparator] =>
	(comparators.length === 1 && comparators[0]!.operator === ">=") ||
	(comparators.length === 2 &&
		comparators[0]!.operator === ">=" &&
		comparators[1]!.operator === "<")

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

for (const { range } of ranges) {
	// comparators to remove from the set after this operation
	const filter = new WeakSet<readonly Comparator[]>()
	// previous comparator if it was a bounded standard range
	let previous: readonly [Comparator, Comparator] | undefined = undefined

	// sort the set of ranges in ascending number based on their lower bound
	range.set = range.set.toSorted((a, b) =>
		// oxlint-disable-next-line typescript/no-base-to-string
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

			// if our lower bound overlaps with or touches the previous upper bound
			// merge the two ranges into a single one
			if (compare(previousUpper.semver, currentLower.semver) >= 0) {
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
	.map(({ name, range, instrumentation }) => ({
		name,
		versions: range.set
			// oxlint-disable-next-line typescript/no-base-to-string
			.map((comparators) => comparators.join(" "))
			.join(" || ")
			.replace(/^$/, "*"),
		instrumentation,
	}))
	.toSorted((a, b) => a.name.localeCompare(b.name))

const table = supported
	.map(
		({ name, versions, instrumentation }) =>
			`| \`${name}\` | \`${versions.replaceAll("|", "\\|")}\` | \`${instrumentation}\` |`,
	)
	.join("\n")
const md = `
# Module Compatibility

| Name | Versions | Instrumentation |
| ---- | -------- | --------------- |
${table}
`

await writeFile("./COMPATIBILITY.md", md)

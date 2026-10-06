/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import fs from "node:fs/promises"

import resolver from "enhanced-resolve"

import meta from "../package.json" with { type: "json" }

interface Metadata {
	version?: string
	dependencies?: Record<string, string>
	peerDependencies?: Record<string, string>
	optionalDependencies?: Record<string, string>
}

export interface Dependency {
	name: string
	version?: string
	paths: Set<string>
}

export async function dependencies(): Promise<Dependency[]> {
	const resolve = resolver.create({
		symlinks: true,
		conditionNames: ["node-addons", "node", "import", "require", "module-sync", "default"],
	})
	const resolved = new Map<string, Dependency>()

	const metadata = (ctx: string, dep: string) =>
		new Promise<[string, Metadata] | undefined>((res) => {
			resolve(ctx, dep, (error, _, request) => {
				const path = request?.descriptionFileRoot
				if (error || !path) {
					res(undefined)
					return
				}

				const metadata: Metadata = request.descriptionFileData ?? {}
				res([path, metadata])
			})
		})
	const process = async (ctx: string, dep: string) => {
		const result = (await metadata(ctx, dep)) ?? (await metadata(ctx, `${dep}/package.json`))
		if (!result) {
			return
		}

		const [dir, meta] = result
		const key = await fs.realpath(dir)

		const cached = resolved.get(key)
		if (cached?.paths.has(dir)) {
			// break dependency cycles
			return
		} else if (cached) {
			cached.paths.add(dir)
		} else {
			resolved.set(key, { name: dep, version: meta.version, paths: new Set([key, dir]) })
		}

		await Promise.all(
			[
				...Object.keys(meta.dependencies ?? {}),
				...Object.keys(meta.peerDependencies ?? {}),
				...Object.keys(meta.optionalDependencies ?? {}),
			].map((dep) => process(key, dep)),
		)
	}

	await Promise.all(
		[...Object.keys(meta.dependencies), ...Object.keys(meta.peerDependencies)].map((dep) =>
			process(import.meta.dirname, dep),
		),
	)

	return [...resolved.values()]
}

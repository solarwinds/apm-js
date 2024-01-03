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
import path from "node:path"
import process from "node:process"

import json from "@rollup/plugin-json"
import typescript from "@rollup/plugin-typescript"
import globby from "globby"
import nodeExternals from "rollup-plugin-node-externals"

const FORMATS = ["es", "cjs"]

async function task(src, dist, format, sources) {
  const dir = path.join(dist, format)

  if (format === "cjs") {
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ type: "commonjs" }),
    )
  }

  const input = Object.fromEntries(
    sources
      .map((file) => {
        // file name without directory or extension
        const name = path
          .relative(src, file)
          .slice(0, -path.extname(file).length)
        // full file path
        const full = path.join(process.cwd(), file)

        return [name, full]
      })
      .filter(([name]) => {
        // detect `.es`/`.cjs` and filter out if it doesn't match the current format
        const specifier = FORMATS.find((format) => name.endsWith(`.${format}`))
        return specifier ? specifier === format : true
      }),
  )

  const output = {
    format,
    dir,
    sourcemap: true,
  }

  return {
    plugins: [
      nodeExternals({ deps: true, peerDeps: true, devDeps: true }),
      typescript({
        outputToFilesystem: true,
        cacheDir: path.join("node_modules", ".cache", "rollup", format),

        compilerOptions: {
          rootDir: src,
          outDir: dir,
          // following required cause the plugin overrides tsconfig.json for some reason
          // https://github.com/rollup/plugins/issues/1583
          module: "node16",
          moduleResolution: "node16",
        },
      }),
      json({ preferConst: true }),
    ],
    input,
    output,
  }
}

export default async function config(src = "src", dist = "dist") {
  const sources = await globby(`${src}/**/*.{ts,js}`)
  return await Promise.all(
    FORMATS.map((format) => task(src, dist, format, sources)),
  )
}

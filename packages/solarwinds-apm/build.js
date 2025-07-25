/*
Copyright 2023-2025 SolarWinds Worldwide, LLC.

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

import { agents } from "caniuse-lite"
import esbuild from "esbuild"
import prettier from "prettier"

const version = JSON.parse(
  await fs.readFile("package.json", { encoding: "utf-8" }),
).version

await fs.writeFile(
  "src/version.ts",
  await prettier.format(`export const VERSION = "${version}"`, {
    parser: "typescript",
  }),
)
await fs.writeFile(
  "src/commonjs/timestamp.js",
  await prettier.format(
    [`"use strict";`, `module.exports = ${Date.now()};`].join("\n"),
    { parser: "typescript" },
  ),
)

await fs.mkdir("dist/commonjs", { recursive: true })
await fs.cp("src/commonjs/", "dist/commonjs/", { recursive: true, force: true })

// Generate the web instrumentation bundle to target the Chrome/Safari/Firefox/Edge
// versions which were the latest 1 year ago as a default
// People can still bundle themselves if this isn't satisfactory
const targets = Object.entries(agents)
  .filter(([name]) => ["chrome", "safari", "firefox", "edge"].includes(name))
  .map(([name, data]) => {
    const deadline = new Date()
    deadline.setFullYear(deadline.getFullYear() - 1)

    const version = data.versions.findLast(
      (version) =>
        Number.isSafeInteger(data.release_date[version]) &&
        new Date(data.release_date[version] * 1000) <= deadline,
    )

    return name + version
  })

await esbuild.build({
  entryPoints: ["src/web/index.ts"],
  outfile: "dist/web.js",
  format: "esm",
  target: targets,
  bundle: true,
  minify: true,
  keepNames: true,
  sourcemap: "linked",
  external: ["node:*"],
})

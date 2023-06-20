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

import { dependencies } from "../src"
import { type PnpApi } from "../src/pnp-api"

// eslint-disable-next-line
const pnpApi = require("node:module").findPnpApi(__dirname) as PnpApi
// eslint-disable-next-line
const packageJson = require("../package.json") as {
  devDependencies: Record<string, string>
}

it.each(Object.keys(packageJson.devDependencies))("detects %s", (name) => {
  const deps = dependencies(pnpApi)
  expect(deps.has(name)).toBe(true)
})

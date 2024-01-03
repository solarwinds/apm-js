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

import module from "node:module"
import process from "node:process"

import semver from "semver"

import { init } from "./init.js"
import { setter } from "./symbols.js"

// register only once
const setRegister = setter("register")
if (setRegister && semver.gte(process.versions.node, "20.8.0")) {
  setRegister()
  module.register("./hooks.es.js", import.meta.url)
}

try {
  await init()
} catch (err) {
  console.warn(err)
}

export * from "./api.js"

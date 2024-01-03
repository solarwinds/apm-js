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

const fs = require("node:fs")
const path = require("node:path")

const envPath = path.join(__dirname, "..", ".env")

if (fs.existsSync(envPath)) {
  const contents = fs.readFileSync(envPath, "utf8")
  const kvs = contents
    .split("\n")
    .filter((l) => !l.startsWith("#"))
    .map((l) => {
      const [k, ...v] = l.split("=")
      return v.length && [k.trim(), v.join("=").trim()]
    })
    .filter((kv) => kv)
  Object.assign(process.env, Object.fromEntries(kvs))
}

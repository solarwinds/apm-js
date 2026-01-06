/*
Copyright 2023-2026 SolarWinds Worldwide, LLC.

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

await fs.rm("dist/commonjs", { recursive: true, force: true })
await fs.mkdir("dist/commonjs", { recursive: true })
await fs.cp("src/commonjs/", "dist/commonjs/", { recursive: true, force: true })

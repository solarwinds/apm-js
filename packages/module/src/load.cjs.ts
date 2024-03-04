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

export function load(file: string): unknown {
  /* eslint-disable-next-line @typescript-eslint/no-var-requires */
  const required: unknown = require(file)

  const isObject = typeof required === "object" && required !== null
  const hasDefault = isObject && "default" in required
  const keyCount = isObject && Object.keys(required).length

  const useDefaultExport =
    hasDefault &&
    (keyCount === 1 || (keyCount === 2 && "__esModule" in required))

  if (useDefaultExport) return required.default
  else return required
}

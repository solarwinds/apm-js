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

import { name, version } from "../package.json"

const ID = `${name}@${version}`

/**
 * Checks if a global flag is set. If it isn't returns a setter function for it,
 * otherwise returns false.
 *
 * @param id - Unique ID to check and set
 * @returns Setter function or false if already set
 */
export function setter(id: string): ((value?: unknown) => void) | false {
  const symbol = Symbol.for(`${ID}/${id}`)
  if (symbol in globalThis) return false

  return (value = true) =>
    Object.defineProperty(globalThis, symbol, {
      value,
      writable: false,
      enumerable: false,
      configurable: false,
    })
}

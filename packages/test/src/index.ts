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

import "./plugin"

import * as test from "node:test"

export { expect } from "chai"
export { describe, it } from "node:test"

// Node supports async functions in tests but not hooks for some reason,
// so we add a little bit of code to make it possible
export type Hook = (done: () => void) => void | Promise<void>
const hook = (f: Hook) => (done: () => void) => {
  const result = f(done)
  if (typeof result === "object") {
    result.then(done).catch(done)
  }
}

export function after(f: Hook): void {
  test.after(hook(f))
}
export function afterEach(f: Hook): void {
  test.afterEach(hook(f))
}
export function before(f: Hook): void {
  test.before(hook(f))
}
export function beforeEach(f: Hook): void {
  test.beforeEach(hook(f))
}

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

import "./plugin.js"

import * as test from "node:test"

import * as chai from "chai"
import chaiAsPromised from "chai-as-promised"
import * as semver from "semver"

chai.use(chaiAsPromised)

export { expect } from "chai"

// Node 16 doesn't support async functions in tests
// so we add a little bit of code to make it possible.
// TODO: Remove this once Node 16 support is dropped
export type Fn = () => void | Promise<void>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wrap = (f: Fn): any =>
  semver.gte(process.versions.node, "18.0.0")
    ? f
    : (done: () => void) => {
        const result = f()
        if (typeof result === "object") {
          result.then(done).catch(done)
        } else {
          done()
        }
      }

export function describe(name: string, f: () => void): unknown {
  return test.describe(name, f)
}

export function it(name: string, f: Fn): unknown {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  return test.it(name, wrap(f))
}

export function after(f: Fn): void {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  test.after(wrap(f))
}
export function afterEach(f: Fn): void {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  test.afterEach(wrap(f))
}
export function before(f: Fn): void {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  test.before(wrap(f))
}
export function beforeEach(f: Fn): void {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  test.beforeEach(wrap(f))
}

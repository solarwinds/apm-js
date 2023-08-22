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

import { Assertion, util } from "chai"

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Chai {
    interface Assertion {
      loosely: Assertion
    }
  }
}

function isBasicObject(o: unknown): o is object {
  if (o === null) return false
  if (typeof o !== "object") return false

  const proto = Object.getPrototypeOf(o) as unknown
  return proto === Object.prototype || proto === null
}

function withoutUndefinedProperties(o: object): object {
  const copy = Object.create(
    Object.getPrototypeOf(o) as object | null,
    Object.getOwnPropertyDescriptors(o),
  ) as object

  for (const key of Reflect.ownKeys(copy)) {
    const descriptor = Reflect.getOwnPropertyDescriptor(copy, key)!
    if (
      descriptor.enumerable &&
      descriptor.configurable &&
      descriptor.value === undefined
    ) {
      Reflect.deleteProperty(copy, key)
    }
  }

  return copy
}

Assertion.addChainableMethod(
  "loosely",
  function loosely() {
    // doesn't do any assertions when chained
  },
  function loosely(this: Chai.AssertionPrototype) {
    util.flag(this, "loose", true)
  },
)

// By default Chai does not consider {} and { key: undefined } to be equal (which is reasonable),
// however we sometimes want that behaviour in tests and patch the default assertion to add that option
Assertion.overwriteMethod(
  "equal",
  (base: Chai.Equal): Chai.Equal =>
    function equal(
      this: Chai.AssertionPrototype & Chai.Assertion,
      value: unknown,
      message,
    ) {
      if (!util.flag(this, "loose")) {
        return base.call(this, value, message)
      }

      if (!isBasicObject(this._obj) || !isBasicObject(value)) {
        return base.call(this, value, message)
      }

      const obj = withoutUndefinedProperties(this._obj)
      const assertion = new Assertion(withoutUndefinedProperties(obj))
      util.transferFlags(this, assertion)
      util.flag(assertion, "object", obj)

      return base.call(assertion, withoutUndefinedProperties(value), message)
    },
)

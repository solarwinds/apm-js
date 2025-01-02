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

function withoutUndefinedProperties(
  source: object,
  deep: boolean,
  copy = true,
): object {
  const object = copy
    ? (Object.create(
        Object.getPrototypeOf(source) as object | null,
        Object.getOwnPropertyDescriptors(source),
      ) as object)
    : source

  for (const key of Reflect.ownKeys(object)) {
    const descriptor = Reflect.getOwnPropertyDescriptor(object, key)!
    if (
      descriptor.enumerable &&
      descriptor.configurable &&
      descriptor.value === undefined
    ) {
      Reflect.deleteProperty(object, key)
    } else if (deep && isBasicObject(descriptor.value)) {
      withoutUndefinedProperties(descriptor.value, true, false)
    }
  }

  return object
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

function loosely<B extends Chai.Equal | Chai.Include>(base: B): B {
  return new Proxy<B>(base, {
    apply(
      base: B,
      assertion: Chai.AssertionPrototype & Chai.Assertion,
      [value, message]: [unknown, string | undefined],
    ) {
      if (!util.flag(assertion, "loose")) {
        return base.call(assertion, value, message)
      }
      if (!isBasicObject(assertion._obj) || !isBasicObject(value)) {
        return base.call(assertion, value, message)
      }

      const deep = !!util.flag(assertion, "deep")

      const object = withoutUndefinedProperties(assertion._obj, deep)
      util.flag(assertion, "object", object)

      return base.call(
        assertion,
        withoutUndefinedProperties(value, deep),
        message,
      )
    },
  })
}
const identity = <T>(v?: T): T | undefined => v

Assertion.overwriteMethod("equal", loosely)
Assertion.overwriteMethod("equals", loosely)
Assertion.overwriteChainableMethod("include", loosely, identity)
Assertion.overwriteChainableMethod("includes", loosely, identity)
Assertion.overwriteChainableMethod("contain", loosely, identity)
Assertion.overwriteChainableMethod("contains", loosely, identity)

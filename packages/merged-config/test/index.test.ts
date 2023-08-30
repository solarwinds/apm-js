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

import { beforeEach, expect, it } from "@solarwinds-apm/test"

import * as mc from "../src/index"

beforeEach(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("TEST_")) Reflect.deleteProperty(process.env, key)
  }
})

it("should pick up file options", () => {
  const file = { name: "Joe", age: 42 }

  const result = mc.config({ name: { file: true }, age: { file: true } }, file)

  expect(result).to.deep.equal(file)
})

it("should pick up env options", () => {
  process.env.TEST_NAME = "Joe"
  process.env.TEST_AGE = "42"

  const result = mc.config(
    { name: { env: true }, age: { env: true } },
    {},
    "TEST_",
  )

  expect(result).to.deep.equal({ name: "Joe", age: "42" })
})

it("should prioritise env over file", () => {
  const file = { name: "Joe" }
  process.env.TEST_NAME = "Jane"

  const result = mc.config({ name: { file: true, env: true } }, file, "TEST_")

  expect(result).to.deep.equal({ name: "Jane" })
})

it("should properly case env", () => {
  process.env.TEST_FULL_NAME = "Jane Doe"

  const result = mc.config({ fullName: { env: true } }, {}, "TEST_")

  expect(result).to.deep.equal({ fullName: "Jane Doe" })
})

it("should support custom env name", () => {
  process.env.TEST_NAME = "Jane Doe"

  const result = mc.config({ fullName: { env: "TEST_NAME" } }, {}, "TEST_")

  expect(result).to.deep.equal({ fullName: "Jane Doe" })
})

it("should use default if not present", () => {
  const result = mc.config({ name: { file: true, default: "Joe" } }, {})

  expect(result).to.deep.equal({ name: "Joe" })
})

it("should not use default if present", () => {
  const result = mc.config(
    { name: { file: true, default: "Joe" } },
    { name: "Jane" },
  )

  expect(result).to.deep.equal({ name: "Jane" })
})

it("should throw if required and not present", () => {
  expect(() =>
    mc.config({ name: { file: true, required: true } }, {}),
  ).to.throw(/name/)
})

it("should not throw if required and present", () => {
  expect(() =>
    mc.config({ name: { file: true, required: true } }, { name: "Joe" }),
  ).not.to.throw()
})

it("should use the provided parser", () => {
  const file = { age: "42" }

  const result = mc.config(
    { age: { file: true, parser: Number } },
    file,
    "TEST_",
  )

  expect(result).to.deep.equal({ age: 42 })
})

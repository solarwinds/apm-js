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

import { describe, expect, it } from "@solarwinds-apm/test"

import { firstIfArray, joinIfArray } from "../src/util.js"

describe("firstIfArray", () => {
  it("returns undefined if undefined", () => {
    expect(firstIfArray<string>(undefined)).to.be.undefined
  })

  it("returns value if not array", () => {
    expect(firstIfArray("value")).to.equal("value")
  })

  it("returns undefined if empty array", () => {
    expect(firstIfArray<number>([])).to.be.undefined
  })

  it("returns first element if array", () => {
    expect(firstIfArray([1, 2])).to.equal(1)
  })
})

describe("joinIfArray", () => {
  it("returns undefined if undefined", () => {
    expect(joinIfArray(undefined, ";")).to.be.undefined
  })

  it("returns value if not array", () => {
    expect(joinIfArray("value", ";")).to.equal("value")
  })

  it("returns undefined if empty array", () => {
    expect(joinIfArray([], ";")).to.be.undefined
  })

  it("returns joined if array", () => {
    expect(joinIfArray(["foo", "bar"], ";")).to.equal("foo;bar")
  })
})

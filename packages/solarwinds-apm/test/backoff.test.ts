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

import { Backoff } from "../src/backoff.js"

describe("Backoff", () => {
  it("works as expected", () => {
    const backoff = new Backoff({
      initial: 1,
      max: 10,
      multiplier: 2,
      retries: 5,
    })

    expect(backoff.backoff()).to.equal(1)
    expect(backoff.backoff()).to.equal(2)
    expect(backoff.backoff()).to.equal(4)
    expect(backoff.backoff()).to.equal(8)
    expect(backoff.backoff()).to.equal(10)
    expect(backoff.backoff()).to.be.false

    backoff.reset()

    expect(backoff.backoff()).to.equal(1)
    expect(backoff.backoff()).to.equal(2)
    expect(backoff.backoff()).to.equal(4)
    expect(backoff.backoff()).to.equal(8)
    expect(backoff.backoff()).to.equal(10)
    expect(backoff.backoff()).to.be.false
  })

  it("keeps going when not limited", () => {
    const backoff = new Backoff({
      initial: 1,
      multiplier: 2,
    })

    for (let i = 0; i < 24; i++) {
      expect(backoff.backoff()).to.equal(2 ** i)
    }
  })

  it("rejects invalid initial value", () => {
    let backoff: unknown
    let error: unknown

    try {
      backoff = new Backoff({ initial: -1, multiplier: 2 })
    } catch (err) {
      error = err
    }

    expect(backoff).to.be.undefined
    expect(error).not.to.be.undefined
  })

  it("rejects invalid max value", () => {
    let backoff: unknown
    let error: unknown

    try {
      backoff = new Backoff({ initial: 10, max: 1, multiplier: 2 })
    } catch (err) {
      error = err
    }

    expect(backoff).to.be.undefined
    expect(error).not.to.be.undefined
  })

  it("rejects invalid retries value", () => {
    let backoff: unknown
    let error: unknown

    try {
      backoff = new Backoff({ initial: 1, multiplier: 2, retries: -10 })
    } catch (err) {
      error = err
    }

    expect(backoff).to.be.undefined
    expect(error).not.to.be.undefined
  })
})

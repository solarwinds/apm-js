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

import { describe, expect, it } from "@solarwinds-apm/test"

import { Dice } from "../src/dice.js"

describe("Dice", () => {
  it("gives sensible rate over time", () => {
    const dice = new Dice({ scale: 100, rate: 50 })

    let trues = 0
    let falses = 0

    for (let i = 0; i < 1000; i++) {
      if (dice.roll()) trues++
      else falses++
    }

    // We're never gonna get a perfect 50% distributions but
    // statistically we should always be between 40%-60% over 1000 rolls
    // otherwise something is very wrong
    expect(Math.abs(trues - falses)).to.be.below(100)
  }).retries(2)

  it("defaults to zero and never succeeds", () => {
    const dice = new Dice({ scale: 100 })
    for (let i = 0; i < 1000; i++) {
      expect(dice.roll()).to.be.false
    }
  })

  it("always succeeds with full rate", () => {
    const dice = new Dice({ scale: 100, rate: 100 })
    for (let i = 0; i < 1000; i++) {
      expect(dice.roll()).to.be.true
    }
  })

  it("can be updated", () => {
    const dice = new Dice({ scale: 100, rate: 100 })
    for (let i = 0; i < 500; i++) {
      expect(dice.roll()).to.be.true
    }

    dice.update({ rate: 0 })
    for (let i = 0; i < 500; i++) {
      expect(dice.roll()).to.be.false
    }
  })
})

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

import { setTimeout } from "node:timers/promises"

import { describe, expect, it } from "@solarwinds-apm/test"

import { TokenBucket } from "../src/token-bucket.js"

describe("TokenBucket", () => {
  it("starts full", () => {
    const bucket = new TokenBucket({ capacity: 2, rate: 1, interval: 10 })
    expect(bucket.consume(2)).to.be.true
  })

  it("can't consume more than it contains", () => {
    const bucket = new TokenBucket({ capacity: 1, rate: 1, interval: 10 })
    expect(bucket.consume(2)).to.be.false
    expect(bucket.consume()).to.be.true
  })

  it("replenishes over time", async () => {
    const bucket = new TokenBucket({ capacity: 2, rate: 1, interval: 10 })
    expect(bucket.consume(2)).to.be.true

    bucket.start()
    await setTimeout(50)
    bucket.stop()
    expect(bucket.consume(2)).to.be.true
  })

  it("doesn't replenish more than it's capacity", async () => {
    const bucket = new TokenBucket({ capacity: 2, rate: 1, interval: 10 })
    expect(bucket.consume(2)).to.be.true

    bucket.start()
    await setTimeout(100)
    bucket.stop()
    expect(bucket.consume(4)).to.be.false
  })

  it("can be updated", () => {
    const bucket = new TokenBucket({ capacity: 1, rate: 1, interval: 10 })
    expect(bucket.consume(2)).to.be.false

    bucket.update({ capacity: 2 })
    expect(bucket.consume(2)).to.be.true
  })

  it("decreases tokens to capacity when updating to a lower one", () => {
    const bucket = new TokenBucket({ capacity: 2, rate: 1, interval: 10 })
    bucket.update({ capacity: 1 })
    expect(bucket.consume(2)).to.be.false
  })

  it("can be updated while running", async () => {
    const bucket = new TokenBucket({ capacity: 8, rate: 1, interval: 10 })
    expect(bucket.consume(8)).to.be.true
    bucket.start()

    bucket.update({ rate: 2, interval: 5 })
    await setTimeout(50)
    bucket.stop()
    expect(bucket.consume(8)).to.be.true
  })

  it("defaults to zero", async () => {
    const bucket = new TokenBucket()

    bucket.start()
    await setTimeout(100)
    bucket.stop()

    expect(bucket.consume()).to.be.false
  })
})

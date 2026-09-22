/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { setTimeout } from "node:timers/promises"

import { describe, expect, it } from "@solarwinds-apm/test"

import { TokenBucket } from "../src/token-bucket.ts"

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
		const bucket = new TokenBucket({ capacity: 8, rate: 0, interval: 10 })
		expect(bucket.consume(8)).to.be.true
		bucket.start()

		bucket.update({ rate: 2, interval: 5 })
		await setTimeout(100)
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

/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { describe, expect, it } from "@solarwinds-apm/test"

import {
	Flags,
	type LocalSettings,
	merge,
	SampleSource,
	type Settings,
	TracingMode,
} from "../src/settings.ts"

describe("merge", () => {
	describe("OVERRIDE is unset", () => {
		it("respects tracing mode NEVER & trigger mode disabled", () => {
			const remote: Settings = {
				sampleRate: 1,
				sampleSource: SampleSource.LocalDefault,
				flags: Flags.SAMPLE_START | Flags.SAMPLE_THROUGH_ALWAYS | Flags.TRIGGERED_TRACE,
				buckets: {},
				timestamp: Math.round(Date.now() / 1000),
				ttl: 60,
			}
			const local: LocalSettings = {
				tracingMode: TracingMode.NEVER,
				triggerMode: false,
			}

			const merged = merge(remote, local)
			expect(merged).to.include({
				flags: 0x0,
			})
		})

		it("respects tracing mode ALWAYS & trigger mode enabled", () => {
			const remote: Settings = {
				sampleRate: 1,
				sampleSource: SampleSource.LocalDefault,
				flags: 0x0,
				buckets: {},
				timestamp: Math.round(Date.now() / 1000),
				ttl: 60,
			}
			const local: LocalSettings = {
				tracingMode: TracingMode.ALWAYS,
				triggerMode: true,
			}

			const merged = merge(remote, local)
			expect(merged).to.include({
				flags: Flags.SAMPLE_START | Flags.SAMPLE_THROUGH_ALWAYS | Flags.TRIGGERED_TRACE,
			})
		})

		it("defaults to remote value when local is unset", () => {
			const remote: Settings = {
				sampleRate: 1,
				sampleSource: SampleSource.LocalDefault,
				flags: Flags.SAMPLE_START | Flags.SAMPLE_THROUGH_ALWAYS | Flags.TRIGGERED_TRACE,
				buckets: {},
				timestamp: Math.round(Date.now() / 1000),
				ttl: 60,
			}
			const local: LocalSettings = {
				triggerMode: true,
			}

			const merged = merge(remote, local)
			expect(merged).to.deep.equal(remote)
		})
	})

	describe("OVERRIDE is set", () => {
		it("respects tracing mode NEVER & trigger mode disabled", () => {
			const remote: Settings = {
				sampleRate: 1,
				sampleSource: SampleSource.LocalDefault,
				flags:
					Flags.OVERRIDE |
					Flags.SAMPLE_START |
					Flags.SAMPLE_THROUGH_ALWAYS |
					Flags.TRIGGERED_TRACE,
				buckets: {},
				timestamp: Math.round(Date.now() / 1000),
				ttl: 60,
			}
			const local: LocalSettings = {
				tracingMode: TracingMode.NEVER,
				triggerMode: false,
			}

			const merged = merge(remote, local)
			expect(merged).to.include({
				flags: Flags.OVERRIDE,
			})
		})

		it("does not respect tracing mode ALWAYS & trigger mode enabled", () => {
			const remote: Settings = {
				sampleRate: 1,
				sampleSource: SampleSource.LocalDefault,
				flags: Flags.OVERRIDE,
				buckets: {},
				timestamp: Math.round(Date.now() / 1000),
				ttl: 60,
			}
			const local: LocalSettings = {
				tracingMode: TracingMode.ALWAYS,
				triggerMode: true,
			}

			const merged = merge(remote, local)
			expect(merged).to.deep.equal(remote)
		})

		it("defaults to remote value when local is unset", () => {
			const remote: Settings = {
				sampleRate: 1,
				sampleSource: SampleSource.LocalDefault,
				flags: Flags.OVERRIDE,
				buckets: {},
				timestamp: Math.round(Date.now() / 1000),
				ttl: 60,
			}
			const local: LocalSettings = {
				triggerMode: false,
			}

			const merged = merge(remote, local)
			expect(merged).to.deep.equal(remote)
		})
	})
})

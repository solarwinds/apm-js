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

import {
  Flags,
  type LocalSettings,
  merge,
  type Settings,
  TracingMode,
} from "../src/settings.js"

describe("merge", () => {
  describe("OVERRIDE is unset", () => {
    it("respects lower sample rate, tracing mode NEVER & trigger mode disabled", () => {
      const remote: Settings = {
        sampleRate: 2,
        flags:
          Flags.SAMPLE_START |
          Flags.SAMPLE_THROUGH_ALWAYS |
          Flags.TRIGGERED_TRACE,
        buckets: {},
        ttl: 60,
      }
      const local: LocalSettings = {
        sampleRate: 1,
        tracingMode: TracingMode.NEVER,
        triggerMode: false,
      }

      const merged = merge(remote, local)
      expect(merged).to.include({
        sampleRate: 1,
        flags: 0x0,
      })
    })

    it("respects higher sample rate, tracing mode ALWAYS & trigger mode enabled", () => {
      const remote: Settings = {
        sampleRate: 1,
        flags: 0x0,
        buckets: {},
        ttl: 60,
      }
      const local: LocalSettings = {
        sampleRate: 2,
        tracingMode: TracingMode.ALWAYS,
        triggerMode: true,
      }

      const merged = merge(remote, local)
      expect(merged).to.include({
        sampleRate: 2,
        flags:
          Flags.SAMPLE_START |
          Flags.SAMPLE_THROUGH_ALWAYS |
          Flags.TRIGGERED_TRACE,
      })
    })

    it("defaults to remote value when local is unset", () => {
      const remote: Settings = {
        sampleRate: 1,
        flags:
          Flags.SAMPLE_START |
          Flags.SAMPLE_THROUGH_ALWAYS |
          Flags.TRIGGERED_TRACE,
        buckets: {},
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
    it("respects lower sample rate, tracing mode NEVER & trigger mode disabled", () => {
      const remote: Settings = {
        sampleRate: 2,
        flags:
          Flags.OVERRIDE |
          Flags.SAMPLE_START |
          Flags.SAMPLE_THROUGH_ALWAYS |
          Flags.TRIGGERED_TRACE,
        buckets: {},
        ttl: 60,
      }
      const local: LocalSettings = {
        sampleRate: 1,
        tracingMode: TracingMode.NEVER,
        triggerMode: false,
      }

      const merged = merge(remote, local)
      expect(merged).to.include({
        sampleRate: 1,
        flags: Flags.OVERRIDE,
      })
    })

    it("does not respect higher sample rate, tracing mode ALWAYS & trigger mode enabled", () => {
      const remote: Settings = {
        sampleRate: 1,
        flags: Flags.OVERRIDE,
        buckets: {},
        ttl: 60,
      }
      const local: LocalSettings = {
        sampleRate: 2,
        tracingMode: TracingMode.ALWAYS,
        triggerMode: true,
      }

      const merged = merge(remote, local)
      expect(merged).to.deep.equal(remote)
    })

    it("defaults to remote value when local is unset", () => {
      const remote: Settings = {
        sampleRate: 1,
        flags: Flags.OVERRIDE,
        buckets: {},
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

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

import { trace } from "@opentelemetry/api"
import { before, describe, expect, it, otel } from "@solarwinds-apm/test"

import { read } from "../../src/config.js"
import { HttpSampler } from "../../src/sampling/http.js"

expect(process.env).to.include.keys("SW_APM_COLLECTOR", "SW_APM_SERVICE_KEY")
const CONFIG = await read()

describe(HttpSampler.name, () => {
  describe("valid service key", () => {
    before(async () => {
      const config = { ...CONFIG }

      const sampler = new HttpSampler(config)
      await otel.reset({ trace: { sampler } })
      await sampler.waitUntilReady(1000)
    })

    it("samples created spans", async () => {
      const tracer = trace.getTracer("test")

      tracer.startActiveSpan("test", (span) => {
        expect(span.isRecording()).to.be.true
        span.end()
      })

      const span = (await otel.spans())[0]
      expect(span).not.to.be.undefined
      expect(span!.attributes).to.include.keys(
        "SampleRate",
        "SampleSource",
        "BucketCapacity",
        "BucketRate",
      )
    }).retries(10)
  })

  describe("invalid service key", () => {
    before(async () => {
      const config = { ...CONFIG, token: "OH NO" }

      const sampler = new HttpSampler(config)
      await otel.reset({ trace: { sampler } })
      await sampler.waitUntilReady(1000)
    })

    it("does not sample created spans", async () => {
      const tracer = trace.getTracer("test")

      tracer.startActiveSpan("test", (span) => {
        expect(span.isRecording()).to.be.false
        span.end()
      })

      const spans = await otel.spans()
      expect(spans).to.be.empty
    })
  })

  describe("invalid collector", () => {
    before(async () => {
      const config = {
        ...CONFIG,
        collector: new URL("https://collector.invalid"),
      }

      const sampler = new HttpSampler(config)
      await otel.reset({ trace: { sampler } })
      await sampler.waitUntilReady(1000)
    })

    it("does not sample created spans", async () => {
      const tracer = trace.getTracer("test")

      tracer.startActiveSpan("test", (span) => {
        expect(span.isRecording()).to.be.false
        span.end()
      })

      const spans = await otel.spans()
      expect(spans).to.be.empty
    })
  })
})

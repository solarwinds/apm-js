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

import { setTimeout } from "node:timers/promises"

import { trace } from "@opentelemetry/api"
import { hrTimeToMilliseconds } from "@opentelemetry/core"
import { beforeEach, describe, expect, it, otel } from "@solarwinds-apm/test"

import { type Configuration } from "../../src/config.js"
import { StacktraceProcessor } from "../../src/processing/stacktrace.js"

describe("StacktraceProcessor", () => {
  describe("without config", () => {
    beforeEach(async () => {
      await otel.reset({
        trace: {
          spanProcessors: [new StacktraceProcessor({} as Configuration)],
        },
      })
    })

    it("doesn't collect stacktrace", async () => {
      const tracer = trace.getTracer("test")

      tracer.startActiveSpan("test", (span) => {
        span.end()
      })

      const spans = await otel.spans()
      expect(spans).to.have.lengthOf(1)
      const span = spans[0]!
      expect(span.attributes["code.stacktrace"]).to.be.undefined
    })
  })

  describe("with duration-based config", () => {
    beforeEach(async () => {
      await otel.reset({
        trace: {
          spanProcessors: [
            new StacktraceProcessor({
              spanStacktraceFilter: (span) =>
                hrTimeToMilliseconds(span.duration) > 100,
            } as Configuration),
          ],
        },
      })
    })

    it("doesn't collect stacktrace for short lived span", async () => {
      const tracer = trace.getTracer("test")

      tracer.startActiveSpan("test", (span) => {
        span.end()
      })

      const spans = await otel.spans()
      expect(spans).to.have.lengthOf(1)
      const span = spans[0]!
      expect(span.attributes["code.stacktrace"]).to.be.undefined
    })

    it("collects stacktrace for long lived span", async () => {
      const tracer = trace.getTracer("test")

      await tracer.startActiveSpan("test", async (span) => {
        await setTimeout(500)
        span.end()
      })

      const spans = await otel.spans()
      expect(spans).to.have.lengthOf(1)
      const span = spans[0]!
      expect(typeof span.attributes["code.stacktrace"]).to.equal("string")
    })
  })
})

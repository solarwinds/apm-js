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

import { trace } from "@opentelemetry/api"
import { before, describe, expect, it, otel } from "@solarwinds-apm/test"

import {
  getRootOrEntry,
  isRootOrEntry,
  ParentSpanProcessor,
} from "../../src/processing/parent-span.js"

describe("ParentSpanProcessor", () => {
  before(async () => {
    await otel.reset({ trace: { processors: [new ParentSpanProcessor()] } })
  })

  it("registers parent span information", () => {
    const tracer = trace.getTracer("test")

    tracer.startActiveSpan("parent", (parentSpan) => {
      expect(isRootOrEntry(parentSpan)).to.be.true
      expect(getRootOrEntry(parentSpan)).to.equal(parentSpan)

      tracer.startActiveSpan("child", (childSpan) => {
        expect(isRootOrEntry(childSpan)).to.be.false
        expect(getRootOrEntry(childSpan)).to.equal(parentSpan)

        childSpan.end()
      })

      parentSpan.end()
    })
  })
})

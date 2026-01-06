/*
Copyright 2023-2026 SolarWinds Worldwide, LLC.

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

import { ROOT_CONTEXT, type Span, trace } from "@opentelemetry/api"
import { describe, expect, it } from "@solarwinds-apm/test"

import { contextStorage, global, spanStorage } from "../src/storage.js"

const tracer = trace.getTracer("test")

describe("global", () => {
  it("works", () => {
    const value = global("test", () => "value")
    expect(value).to.equal("value")
  })

  it("returns existing", () => {
    const value = global("test", () => "not value")
    expect(value).to.equal("value")
  })
})

describe("ContextStorage", () => {
  const storage = contextStorage<string>("test")

  it("works", () => {
    const context = storage.set(ROOT_CONTEXT, "value")
    expect(storage.get(context)).to.equal("value")
  })

  it("returns undefined if unset", () => {
    expect(storage.get(ROOT_CONTEXT)).to.be.undefined
  })
})

describe("SpanStorage", () => {
  const storage = spanStorage<string>("test")

  it("works", () => {
    const span = tracer.startActiveSpan("test", (span) => {
      expect(storage.set(span, "value")).to.be.true

      span.end()
      return span
    })

    expect(storage.get(span)).to.equal("value")

    storage.delete(span)
    expect(storage.get(span)).to.be.undefined
  })

  it("ignores invalid spans", () => {
    const span = {} as Span
    expect(storage.set(span, "value")).to.be.false
    expect(storage.get(span)).to.be.undefined
  })
})

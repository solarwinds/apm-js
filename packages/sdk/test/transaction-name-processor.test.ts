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

import { cache } from "../src/cache"
import { SwTransactionNameProcessor } from "../src/transaction-name-processor"
import * as mock from "./mock"

const processor = new SwTransactionNameProcessor()

describe("SwTransactionNameProcessor", () => {
  describe("root span", () => {
    const span = mock.readableSpan({
      name: "root span",
      parentSpanId: undefined,
    })
    cache.getOrInit(span.spanContext(), { parentId: span.parentSpanId })

    it("sets the transaction name", () => {
      processor.onEnd(span)

      const { txname } = cache.get(span.spanContext())!
      expect(txname).to.equal("root span")
    })
  })

  describe("remote parent span", () => {
    const parentSpanId = mock.spanId()
    const span = mock.readableSpan({
      name: "remote parent span",
      parentSpanId,
    })
    cache.getOrInit(span.spanContext(), {
      parentId: span.parentSpanId,
      parentRemote: true,
    })

    it("sets the transaction name", () => {
      processor.onEnd(span)

      const { txname } = cache.get(span.spanContext())!
      expect(txname).to.equal("remote parent span")
    })
  })

  describe("local parent span", () => {
    const parentSpanId = mock.spanId()
    const span = mock.readableSpan({
      name: "local parent span",
      parentSpanId,
    })
    cache.getOrInit(span.spanContext(), {
      parentId: span.parentSpanId,
      parentRemote: false,
    })

    it("doesn't set the transaction name", () => {
      processor.onEnd(span)

      const { txname } = cache.get(span.spanContext())!
      expect(txname).to.be.undefined
    })
  })
})

/*
Copyright 2023 SolarWinds Worldwide, LLC.

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

import { type Context, ROOT_CONTEXT } from "@opentelemetry/api"
import {
  InMemorySpanExporter,
  type ReadableSpan,
  type Span,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace-base"

import { CompoundSpanProcessor } from "../src/compound-processor"
import * as mock from "./mock"

const forceFlush: symbol[] = []
const onStart: [symbol, Span, Context][] = []
const onEnd: [symbol, ReadableSpan][] = []
const shutdown: symbol[] = []

class TestSpanProcessor implements SpanProcessor {
  constructor(readonly id: symbol) {}
  forceFlush(): Promise<void> {
    forceFlush.push(this.id)
    return Promise.resolve()
  }
  onStart(span: Span, parentContext: Context): void {
    onStart.push([this.id, span, parentContext])
  }
  onEnd(span: ReadableSpan): void {
    onEnd.push([this.id, span])
  }
  shutdown(): Promise<void> {
    shutdown.push(this.id)
    return Promise.resolve()
  }
}

const p1 = new TestSpanProcessor(Symbol("p1"))
const p2 = new TestSpanProcessor(Symbol("p2"))

const exporter = new InMemorySpanExporter()
const processor = new CompoundSpanProcessor(exporter, [p1, p2])

describe("CompoundSpanProcessor", () => {
  describe("forceFlush", () => {
    it("flushes in any order", async () => {
      await processor.forceFlush()
      expect(forceFlush).toContain(p1.id)
      expect(forceFlush).toContain(p2.id)
    })
  })

  describe("onStart", () => {
    it("calls processors in order", () => {
      const span = mock.span()
      const parentContext = ROOT_CONTEXT

      processor.onStart(span, parentContext)
      expect(onStart).toEqual([
        [p1.id, span, parentContext],
        [p2.id, span, parentContext],
      ])
    })
  })

  describe("onEnd", () => {
    it("calls processors in reverse order", () => {
      const span = mock.readableSpan()

      processor.onEnd(span)
      expect(onEnd).toEqual([
        [p2.id, span],
        [p1.id, span],
      ])
    })
  })

  describe("shutdown", () => {
    it("shutdowns in any order", async () => {
      await processor.shutdown()
      expect(shutdown).toContain(p1.id)
      expect(shutdown).toContain(p2.id)
    })
  })
})

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

import { trace } from "@opentelemetry/api"
import type * as sdk from "@opentelemetry/sdk-trace-base"
import {
  SEMATTRS_HTTP_ROUTE,
  SEMATTRS_HTTP_TARGET,
} from "@opentelemetry/semantic-conventions"
import { type SwConfiguration } from "@solarwinds-apm/sdk"
import { describe, expect, it, otel } from "@solarwinds-apm/test"

import { ParentSpanProcessor } from "../../src/processing/parent-span.js"
import {
  computedTransactionName,
  setTransactionName,
  TransactionNamePool,
  TransactionNameProcessor,
} from "../../src/processing/transaction-name.js"

describe("TransactionNameProcessor", () => {
  it("sets transaction name on entry spans", async () => {
    await otel.reset({
      trace: {
        processors: [
          new TransactionNameProcessor({} as SwConfiguration),
          new ParentSpanProcessor(),
        ],
      },
    })

    const tracer = trace.getTracer("test")
    tracer.startActiveSpan("parent", (span) => {
      expect(span.isRecording()).to.be.true

      tracer.startActiveSpan("child", (span) => {
        expect(span.isRecording()).to.be.true
        span.end()
      })

      span.end()
    })

    const spans = await otel.spans()
    expect(spans).to.have.lengthOf(2)

    const parent = spans.find((s) => s.name === "parent")!
    const child = spans.find((s) => s.name === "child")!

    expect(parent.attributes).to.have.property("sw.transaction", "parent")
    expect(child.attributes).not.to.have.property("sw.transaction")
  })

  it("respects configured transaction name", async () => {
    await otel.reset({
      trace: {
        processors: [
          new TransactionNameProcessor({
            transactionName: "default",
          } as SwConfiguration),
          new ParentSpanProcessor(),
        ],
      },
    })

    const tracer = trace.getTracer("test")
    tracer.startActiveSpan("parent", (span) => {
      expect(span.isRecording()).to.be.true

      tracer.startActiveSpan("child", (span) => {
        expect(span.isRecording()).to.be.true
        span.end()
      })

      span.end()
    })

    const spans = await otel.spans()
    expect(spans).to.have.lengthOf(2)

    const parent = spans.find((s) => s.name === "parent")!
    const child = spans.find((s) => s.name === "child")!

    expect(parent.attributes).to.have.property("sw.transaction", "default")
    expect(child.attributes).not.to.have.property("sw.transaction")
  })

  it("respects custom transaction name", async () => {
    await otel.reset({
      trace: {
        processors: [
          new TransactionNameProcessor({
            transactionName: "default",
          } as SwConfiguration),
          new ParentSpanProcessor(),
        ],
      },
    })

    const tracer = trace.getTracer("test")
    tracer.startActiveSpan("parent", (span) => {
      expect(span.isRecording()).to.be.true

      tracer.startActiveSpan("child", (span) => {
        expect(span.isRecording()).to.be.true

        expect(setTransactionName("custom")).to.be.true

        span.end()
      })

      span.end()
    })

    const spans = await otel.spans()
    expect(spans).to.have.lengthOf(2)

    const parent = spans.find((s) => s.name === "parent")!
    const child = spans.find((s) => s.name === "child")!

    expect(parent.attributes).to.have.property("sw.transaction", "custom")
    expect(child.attributes).not.to.have.property("sw.transaction")
  })

  it("has a max cardinality of 200 + 1", async () => {
    await otel.reset({
      trace: {
        processors: [
          new TransactionNameProcessor({} as SwConfiguration),
          new ParentSpanProcessor(),
        ],
      },
    })

    const tracer = trace.getTracer("test")
    for (let i = 0; i <= 200; i++) {
      const span = tracer.startSpan(i.toString())
      span.end()
    }

    const spans = await otel.spans()
    expect(spans).to.have.lengthOf(201)

    const didNotMakeIt = spans.filter(
      (span) => span.attributes["sw.transaction"] === "other",
    )
    expect(didNotMakeIt).to.have.lengthOf(1)
  })
})

describe("computedTransactionName", () => {
  it("computes normal span name", () => {
    const span = trace.getTracer("test").startSpan("test") as sdk.Span
    span.end()

    expect(computedTransactionName(span)).to.equal("test")
  })

  it("computes routed HTTP span name", () => {
    const span = trace.getTracer("test").startSpan("GET", {
      attributes: {
        [SEMATTRS_HTTP_ROUTE]: "/hello/:name",
        [SEMATTRS_HTTP_TARGET]: "/hello/world",
      },
    }) as sdk.Span
    span.end()

    expect(computedTransactionName(span)).to.equal("/hello/:name")
  })

  it("computes short HTTP span name", () => {
    const span = trace.getTracer("test").startSpan("GET", {
      attributes: { [SEMATTRS_HTTP_TARGET]: "/cart" },
    }) as sdk.Span
    span.end()

    expect(computedTransactionName(span)).to.equal("/cart")
  })

  it("computes long HTTP span name", () => {
    const span = trace.getTracer("test").startSpan("GET", {
      attributes: { [SEMATTRS_HTTP_TARGET]: "/shop/products/293/detail" },
    }) as sdk.Span
    span.end()

    expect(computedTransactionName(span)).to.equal("/shop/products")
  })

  it("computes lambda span name", () => {
    const init = process.env.AWS_LAMBDA_FUNCTION_NAME
    process.env.AWS_LAMBDA_FUNCTION_NAME = "lambda"

    const span = trace.getTracer("test").startSpan("GET", {
      attributes: {
        [SEMATTRS_HTTP_ROUTE]: "/hello/:name",
        [SEMATTRS_HTTP_TARGET]: "/hello/world",
      },
    }) as sdk.Span
    span.end()

    expect(computedTransactionName(span)).to.equal("lambda")

    process.env.AWS_LAMBDA_FUNCTION_NAME = init
  })
})

describe("TransactionNamePool", () => {
  it("works as expected", async () => {
    const pool = new TransactionNamePool({
      max: 2,
      ttl: 10,
      default: "default",
    })

    expect(pool.registered("foo")).to.equal("foo")
    expect(pool.registered("bar")).to.equal("bar")
    expect(pool.registered("baz")).to.equal("default")
    expect(pool.registered("foo")).to.equal("foo")

    await setTimeout(50)

    expect(pool.registered("baz")).to.equal("baz")
  })
})

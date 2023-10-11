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

import { SpanStatusCode, trace } from "@opentelemetry/api"
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base"
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node"
import { SemanticAttributes } from "@opentelemetry/semantic-conventions"
import { beforeEach, describe, expect, it } from "@solarwinds-apm/test"

import { instrument, pInstrument } from "../src/index.js"

const exporter = new InMemorySpanExporter()
const processor = new SimpleSpanProcessor(exporter)
const provider = new NodeTracerProvider()

provider.addSpanProcessor(processor)
provider.register()

function inParent(f: () => void | Promise<void>) {
  return trace.getTracer("test").startActiveSpan("parent", async (span) => {
    await f()
    span.end()
  })
}

describe("instrument", () => {
  beforeEach(() => {
    exporter.reset()
  })

  it("doesn't instrument if there's no parent span", () => {
    const r = instrument("parent", () => "return")
    expect(r).to.equal("return")

    const spans = exporter.getFinishedSpans()
    expect(spans).to.be.empty
  })

  it("doesn't instrument if explicitly disabled", async () => {
    await inParent(() => {
      const r = instrument("child", () => "return", { enabled: false })
      expect(r).to.equal("return")
    })

    const spans = exporter.getFinishedSpans()
    expect(spans).to.have.length(1)
    expect(spans[0]?.name).to.equal("parent")
  })

  it("instruments synchronous function", async () => {
    await inParent(() => {
      const r = instrument("child", () => "return")
      expect(r).to.equal("return")
    })

    const span = exporter.getFinishedSpans()[0]
    expect(span?.name).to.equal("child")
  })

  it("supports custom attributes", async () => {
    await inParent(() => {
      const r = instrument(
        () => ({ name: "child", kvpairs: { key: "value" } }),
        () => "return",
      )
      expect(r).to.equal("return")
    })

    const span = exporter.getFinishedSpans()[0]
    expect(span?.name).to.equal("child")
    expect(span?.attributes).to.have.property("key", "value")
  })

  it("captures errors", async () => {
    await inParent(() => {
      let error: unknown = undefined
      try {
        instrument("child", () => {
          throw new Error("error")
        })
      } catch (e) {
        error = e
      }
      expect(error).to.be.an.instanceof(Error)
    })

    const span = exporter.getFinishedSpans()[0]
    expect(span?.name).to.equal("child")
    expect(span?.status).to.include({
      code: SpanStatusCode.ERROR,
      message: "error",
    })
    expect(span?.attributes).to.have.property(
      SemanticAttributes.EXCEPTION_STACKTRACE,
    )
  })

  it("doesn't collect backtraces if explicitly disabled", async () => {
    await inParent(() => {
      let error: unknown = undefined
      try {
        instrument(
          "child",
          () => {
            throw new Error("error")
          },
          { collectBacktraces: false },
        )
      } catch (e) {
        error = e
      }
      expect(error).to.be.an.instanceof(Error)
    })

    const span = exporter.getFinishedSpans()[0]
    expect(span?.name).to.equal("child")
    expect(span?.status).to.include({
      code: SpanStatusCode.ERROR,
      message: "error",
    })
    expect(span?.attributes).not.to.have.property(
      SemanticAttributes.EXCEPTION_STACKTRACE,
    )
  })

  it("instruments callback code", async () => {
    await inParent(
      () =>
        new Promise((res) =>
          instrument(
            "child",
            (done) => setTimeout(() => done("done"), 10),
            (arg) => {
              expect(arg).to.equal("done")
              res()
            },
          ),
        ),
    )

    const span = exporter.getFinishedSpans()[0]
    expect(span?.name).to.equal("child")
  })

  it("captures callback code errors", async () => {
    await inParent(
      () =>
        new Promise((res) =>
          instrument(
            "child",
            (done) => setTimeout(() => done(new Error("error")), 10),
            (arg) => {
              expect(arg).to.be.an.instanceof(Error)
              res()
            },
          ),
        ),
    )

    const span = exporter.getFinishedSpans()[0]
    expect(span?.name).to.equal("child")
    expect(span?.status).to.include({
      code: SpanStatusCode.ERROR,
      message: "error",
    })
    expect(span?.attributes).to.have.property(
      SemanticAttributes.EXCEPTION_STACKTRACE,
    )
  })

  it("instruments callback code with options", async () => {
    await inParent(
      () =>
        new Promise((res) =>
          instrument(
            "child",
            (done) => setTimeout(() => done("done"), 10),
            {},
            (arg) => {
              expect(arg).to.equal("done")
              res()
            },
          ),
        ),
    )

    const span = exporter.getFinishedSpans()[0]
    expect(span?.name).to.equal("child")
  })
})

describe("pInstrument", () => {
  beforeEach(() => {
    exporter.reset()
  })

  it("doesn't instrument if there's no parent span", async () => {
    const r = await pInstrument("parent", () => Promise.resolve("return"))
    expect(r).to.equal("return")

    const spans = exporter.getFinishedSpans()
    expect(spans).to.be.empty
  })

  it("doesn't instrument if explicitly disabled", async () => {
    await inParent(async () => {
      const r = await pInstrument("child", () => Promise.resolve("return"), {
        enabled: false,
      })
      expect(r).to.equal("return")
    })

    const spans = exporter.getFinishedSpans()
    expect(spans).to.have.length(1)
    expect(spans[0]?.name).to.equal("parent")
  })

  it("instruments async function", async () => {
    await inParent(async () => {
      const r = await pInstrument("child", () => Promise.resolve("return"))
      expect(r).to.equal("return")
    })

    const span = exporter.getFinishedSpans()[0]
    expect(span?.name).to.equal("child")
  })

  it("supports custom attributes", async () => {
    await inParent(async () => {
      const r = await pInstrument(
        () => ({ name: "child", kvpairs: { key: "value" } }),
        () => Promise.resolve("return"),
      )
      expect(r).to.equal("return")
    })

    const span = exporter.getFinishedSpans()[0]
    expect(span?.name).to.equal("child")
    expect(span?.attributes).to.have.property("key", "value")
  })

  it("captures errors", async () => {
    await inParent(async () => {
      let error: unknown = undefined
      try {
        await pInstrument("child", async () => {
          await Promise.resolve()
          throw new Error("error")
        })
      } catch (e) {
        error = e
      }
      expect(error).to.be.an.instanceof(Error)
    })

    const span = exporter.getFinishedSpans()[0]
    expect(span?.name).to.equal("child")
    expect(span?.status).to.include({
      code: SpanStatusCode.ERROR,
      message: "error",
    })
    expect(span?.attributes).to.have.property(
      SemanticAttributes.EXCEPTION_STACKTRACE,
    )
  })

  it("doesn't collect backtraces if explicitly disabled", async () => {
    await inParent(async () => {
      let error: unknown = undefined
      try {
        await pInstrument(
          "child",
          async () => {
            await Promise.resolve()
            throw new Error("error")
          },
          { collectBacktraces: false },
        )
      } catch (e) {
        error = e
      }
      expect(error).to.be.an.instanceof(Error)
    })

    const span = exporter.getFinishedSpans()[0]
    expect(span?.name).to.equal("child")
    expect(span?.status).to.include({
      code: SpanStatusCode.ERROR,
      message: "error",
    })
    expect(span?.attributes).not.to.have.property(
      SemanticAttributes.EXCEPTION_STACKTRACE,
    )
  })
})

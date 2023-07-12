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

import { instrument, pInstrument } from "../src"

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

beforeEach(() => {
  exporter.reset()
})

describe("instrument", () => {
  it("doesn't instrument if there's no parent span", () => {
    const r = instrument("parent", () => "return")
    expect(r).toBe("return")

    const span = exporter.getFinishedSpans()[0]
    expect(span).toBeUndefined()
  })

  it("doesn't instrument if explicitly disabled", async () => {
    await inParent(() => {
      const r = instrument("child", () => "return", { enabled: false })
      expect(r).toBe("return")
    })

    const span = exporter.getFinishedSpans()[0]
    expect(span?.name).toBe("parent")
  })

  it("instruments synchronous function", async () => {
    await inParent(() => {
      const r = instrument("child", () => "return")
      expect(r).toBe("return")
    })

    const span = exporter.getFinishedSpans()[0]
    expect(span?.name).toBe("child")
  })

  it("supports custom attributes", async () => {
    await inParent(() => {
      const r = instrument(
        () => ({ name: "child", kvpairs: { key: "value" } }),
        () => "return",
      )
      expect(r).toBe("return")
    })

    const span = exporter.getFinishedSpans()[0]
    expect(span?.name).toBe("child")
    expect(span?.attributes).toMatchObject({ key: "value" })
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
      expect(error).toBeInstanceOf(Error)
    })

    const span = exporter.getFinishedSpans()[0]
    expect(span?.name).toBe("child")
    expect(span?.status).toMatchObject({
      code: SpanStatusCode.ERROR,
      message: "error",
    })
    expect(
      span?.attributes[SemanticAttributes.EXCEPTION_STACKTRACE],
    ).toBeDefined()
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
      expect(error).toBeInstanceOf(Error)
    })

    const span = exporter.getFinishedSpans()[0]
    expect(span?.name).toBe("child")
    expect(span?.status).toMatchObject({
      code: SpanStatusCode.ERROR,
      message: "error",
    })
    expect(
      span?.attributes[SemanticAttributes.EXCEPTION_STACKTRACE],
    ).toBeUndefined()
  })

  it("instruments callback code", async () => {
    await inParent(
      () =>
        new Promise((res) =>
          instrument(
            "child",
            (done) => setTimeout(() => done("done"), 10),
            (arg) => {
              expect(arg).toBe("done")
              res()
            },
          ),
        ),
    )

    const span = exporter.getFinishedSpans()[0]
    expect(span?.name).toBe("child")
  })

  it("captures callback code errors", async () => {
    await inParent(
      () =>
        new Promise((res) =>
          instrument(
            "child",
            (done) => setTimeout(() => done(new Error("error")), 10),
            (arg) => {
              expect(arg).toBeInstanceOf(Error)
              res()
            },
          ),
        ),
    )

    const span = exporter.getFinishedSpans()[0]
    expect(span?.name).toBe("child")
    expect(span?.status).toMatchObject({
      code: SpanStatusCode.ERROR,
      message: "error",
    })
    expect(
      span?.attributes[SemanticAttributes.EXCEPTION_STACKTRACE],
    ).toBeDefined()
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
              expect(arg).toBe("done")
              res()
            },
          ),
        ),
    )

    const span = exporter.getFinishedSpans()[0]
    expect(span?.name).toBe("child")
  })
})

describe("pInstrument", () => {
  it("instruments async function", async () => {
    await inParent(async () => {
      const r = await pInstrument("child", () => Promise.resolve("return"))
      expect(r).toBe("return")
    })

    const span = exporter.getFinishedSpans()[0]
    expect(span?.name).toBe("child")
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
      expect(error).toBeInstanceOf(Error)
    })

    const span = exporter.getFinishedSpans()[0]
    expect(span?.name).toBe("child")
    expect(span?.status).toMatchObject({
      code: SpanStatusCode.ERROR,
      message: "error",
    })
    expect(
      span?.attributes[SemanticAttributes.EXCEPTION_STACKTRACE],
    ).toBeDefined()
  })
})

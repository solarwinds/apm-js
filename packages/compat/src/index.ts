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

import {
  type Attributes,
  type Span,
  type SpanStatus,
  SpanStatusCode,
  trace,
} from "@opentelemetry/api"

interface InstrumentOptions {
  enabled?: boolean
}

interface SpanInfo {
  name: string
  kvpairs?: Attributes
  finalize?: (span: Span, last?: Span) => void
}
type SpanOptions = string | (() => SpanInfo)

type AsyncCallback<T, P extends unknown[]> = (...args: P) => T

function startActiveSpan<T>(span: SpanOptions, f: (span: Span) => T): T {
  const s = typeof span === "string" ? { name: span } : span()
  const last = trace.getActiveSpan()

  const tracer = trace.getTracer("solarwinds-apm")
  return tracer.startActiveSpan(s.name, { attributes: s.kvpairs }, (span) => {
    s.finalize?.(span, last)
    return f(span)
  })
}

function setError(span: Span, err: unknown) {
  const status: SpanStatus = { code: SpanStatusCode.ERROR }
  if (err instanceof Error) {
    span.recordException(err)
    status.message = err.message
  } else {
    span.recordException(String(err))
  }
  span.setStatus(status)
}

function makeDone<T, P extends unknown[]>(
  span: Span,
  cb: AsyncCallback<T, P>,
): AsyncCallback<T, P> {
  return (...args) => {
    if (args[0] instanceof Error) {
      setError(span, args[0])
    }

    const r = cb(...args)
    span.end()
    return r
  }
}

export function instrument<T, CT, CP extends unknown[]>(
  span: SpanOptions,
  run: (done: AsyncCallback<CT, CP>) => T,
  options: InstrumentOptions,
  callback: AsyncCallback<CT, CP>,
): T
export function instrument<T, CT, CP extends unknown[]>(
  span: SpanOptions,
  run: (done: AsyncCallback<CT, CP>) => T,
  callback: AsyncCallback<CT, CP>,
): T
export function instrument<T>(
  span: SpanOptions,
  run: () => T,
  options?: InstrumentOptions,
): T
export function instrument<T>(
  span: SpanOptions,
  run: (done: AsyncCallback<unknown, unknown[]>) => T,
  optionsOrCallback?: InstrumentOptions | AsyncCallback<unknown, unknown[]>,
  callback?: AsyncCallback<unknown, unknown[]>,
): T {
  const o: InstrumentOptions =
    typeof optionsOrCallback === "object" ? optionsOrCallback : {}
  const cb: AsyncCallback<unknown, unknown[]> =
    callback ??
    (typeof optionsOrCallback === "function"
      ? optionsOrCallback
      : () => {
          // instrumented function is synchronous
        })

  if (o.enabled === false || !trace.getActiveSpan()) {
    return run(cb)
  }

  return startActiveSpan(span, (span) => {
    const done = makeDone(span, cb)
    try {
      return run(done)
    } catch (err) {
      setError(span, err)
      throw err
    } finally {
      if (run.length === 0) {
        done()
      }
    }
  })
}

export function pInstrument<T>(
  span: SpanOptions,
  run: () => Promise<T>,
  options?: InstrumentOptions,
): Promise<T> {
  if (options?.enabled === false || !trace.getActiveSpan()) {
    return run()
  }

  return startActiveSpan(span, async (span) => {
    try {
      return await run()
    } catch (err) {
      setError(span, err)
      throw err
    } finally {
      span.end()
    }
  })
}

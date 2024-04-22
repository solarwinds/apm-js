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

import { type Context, type Span, trace } from "@opentelemetry/api"
import {
  NoopSpanProcessor,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace-base"

import { spanStorage } from "../storage.js"

const PARENT_STORAGE = spanStorage<Span | false>("solarwinds-apm parent span")

export function isRootOrEntry(span: Span): boolean {
  const parentSpan = PARENT_STORAGE.get(span)
  return parentSpan === false || parentSpan?.spanContext().isRemote === true
}

export function getRootOrEntry(span: Span): Span | undefined {
  let parentSpan = PARENT_STORAGE.get(span)

  while (parentSpan !== undefined) {
    if (parentSpan === false || parentSpan.spanContext().isRemote) {
      return span
    }

    span = parentSpan
    parentSpan = PARENT_STORAGE.get(span)
  }

  return undefined
}

export class ParentSpanProcessor
  extends NoopSpanProcessor
  implements SpanProcessor
{
  override onStart(span: Span, parentContext: Context): void {
    const parentSpan = trace.getSpan(parentContext)
    PARENT_STORAGE.set(span, parentSpan ?? false)
  }
}

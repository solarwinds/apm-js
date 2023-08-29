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

import { type Context, trace, TraceFlags } from "@opentelemetry/api"
import {
  NoopSpanProcessor,
  type ReadableSpan,
  type Span,
} from "@opentelemetry/sdk-trace-base"

import { cache } from "./cache"

export class SwParentInfoSpanProcessor extends NoopSpanProcessor {
  onStart(span: Span, parentContext: Context): void {
    const spanContext = span.spanContext()
    const parentSpanContext = trace.getSpanContext(parentContext)

    const spanCache = cache.getOrInit(spanContext)
    spanCache.parentId = parentSpanContext?.spanId
    spanCache.parentRemote = parentSpanContext?.isRemote
  }

  onEnd(span: ReadableSpan): void {
    const spanContext = span.spanContext()
    // clear here unless sampled in which case the exporter takes care of it
    if (!(spanContext.traceFlags & TraceFlags.SAMPLED)) {
      cache.clear(spanContext)
    }
  }
}

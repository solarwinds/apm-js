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

import {
  NoopSpanProcessor,
  type ReadableSpan,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace-base"
import { ATTR_CODE_STACKTRACE } from "@opentelemetry/semantic-conventions"
import { stacktrace } from "@solarwinds-apm/module"

import { type Configuration } from "../config.js"

export class StacktraceProcessor
  extends NoopSpanProcessor
  implements SpanProcessor
{
  readonly #filter?: (span: ReadableSpan) => number

  constructor(config: Configuration) {
    super()
    this.#filter = config.spanStacktraceFilter
  }

  override onEnd(span: ReadableSpan): void {
    const length = this.#filter?.(span) ?? 0
    if (length > 0) {
      span.attributes[ATTR_CODE_STACKTRACE] = stacktrace(length, false)
    }
  }
}

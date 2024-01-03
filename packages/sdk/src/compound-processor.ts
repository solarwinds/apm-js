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

import { type Context, type DiagLogger } from "@opentelemetry/api"
import {
  BatchSpanProcessor,
  type ReadableSpan,
  type Span,
  type SpanExporter,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace-base"

export class CompoundSpanProcessor extends BatchSpanProcessor {
  constructor(
    exporter: SpanExporter,
    private readonly processors: SpanProcessor[],
    private readonly logger: DiagLogger,
  ) {
    super(exporter)
  }

  override onStart(span: Span, parentContext: Context): void {
    this.logger.verbose("span start", span, parentContext)
    super.onStart(span, parentContext)
    this.processors.forEach((p) => {
      p.onStart(span, parentContext)
    })
  }

  override onEnd(span: ReadableSpan): void {
    this.logger.verbose("span end", span)
    ;[...this.processors].reverse().forEach((p) => {
      p.onEnd(span)
    })
    super.onEnd(span)
  }

  override async forceFlush(): Promise<void> {
    this.logger.debug("flush")
    try {
      await Promise.all(this.processors.map((p) => p.forceFlush()))
      await super.forceFlush()
    } catch (error) {
      this.logger.error("flush error", error)
      throw error
    }
  }

  override async shutdown(): Promise<void> {
    await Promise.all(this.processors.map((p) => p.shutdown()))
    await super.shutdown()
  }
}

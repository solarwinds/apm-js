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

import { type ExportResult } from "@opentelemetry/core"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc"
import { type ReadableSpan } from "@opentelemetry/sdk-trace-base"

import { type SwConfiguration } from "."
import { cache } from "./cache"

export class SwOtlpExporter extends OTLPTraceExporter {
  constructor(private readonly config: SwConfiguration) {
    super()
  }

  override export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void,
  ): void {
    for (const span of spans) {
      const context = span.spanContext()

      const txname = cache.getTxname(context, this.config)
      if (txname) {
        span.attributes["sw.transaction"] = txname
      }

      cache.clear(context)
    }

    super.export(spans, resultCallback)
  }
}

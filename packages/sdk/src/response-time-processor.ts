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
  NoopSpanProcessor,
  type ReadableSpan,
} from "@opentelemetry/sdk-trace-base"

import { type SwConfiguration } from "."
import { cache } from "./cache"
import { isEntrySpan } from "./context"
import { recordServerlessResponseTime } from "./metrics/serverless"

export class SwResponseTimeProcessor extends NoopSpanProcessor {
  constructor(private readonly config: SwConfiguration) {
    super()
  }

  override onEnd(span: ReadableSpan): void {
    if (!isEntrySpan(span)) return

    const txname = cache.getTxname(span.spanContext(), this.config)
    recordServerlessResponseTime(span, txname)
  }
}

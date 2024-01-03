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

import { env } from "node:process"

import { trace } from "@opentelemetry/api"
import {
  NoopSpanProcessor,
  type ReadableSpan,
} from "@opentelemetry/sdk-trace-base"
import { IS_AWS_LAMBDA } from "@solarwinds-apm/module"

import { cache } from "./cache"
import { parentSpanContext } from "./context"

export class SwTransactionNameProcessor extends NoopSpanProcessor {
  override onEnd(span: ReadableSpan): void {
    const context = span.spanContext()
    const parentContext = parentSpanContext(span)

    if (
      parentContext &&
      trace.isSpanContextValid(parentContext) &&
      !parentContext.isRemote
    ) {
      return
    }

    const spanCache = cache.getOrInit(context)
    spanCache.txname = SwTransactionNameProcessor.txname(span)
  }

  private static txname(span: ReadableSpan): string {
    if (IS_AWS_LAMBDA) {
      return env.AWS_LAMBDA_FUNCTION_NAME!
    } else {
      return span.name
    }
  }
}

/*
Copyright 2023-2025 SolarWinds Worldwide, LLC.

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

import { SpanKind } from "@opentelemetry/api"
import { NoopSpanProcessor, type Span } from "@opentelemetry/sdk-trace-base"
import {
  ATTR_URL_FULL,
  ATTR_URL_PATH,
} from "@opentelemetry/semantic-conventions"

/** Processor that adds span attributes based on the current URL in browsers */
export class LocationProcessor extends NoopSpanProcessor {
  override onStart(span: Span): void {
    // We don't want to override those for non-internal spans where it might have
    // another meaning (ie. HTTP client calls)
    if (span.kind === SpanKind.INTERNAL) {
      span.setAttribute(ATTR_URL_FULL, window.location.href)
      span.setAttribute(ATTR_URL_PATH, window.location.pathname)
    }
  }
}

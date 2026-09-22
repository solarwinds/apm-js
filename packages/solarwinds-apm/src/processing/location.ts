/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { SpanKind } from "@opentelemetry/api"
import { NoopSpanProcessor, type Span } from "@opentelemetry/sdk-trace"
import { ATTR_URL_FULL, ATTR_URL_PATH } from "@opentelemetry/semantic-conventions"

/** Processor that adds span attributes based on the current URL in browsers. */
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

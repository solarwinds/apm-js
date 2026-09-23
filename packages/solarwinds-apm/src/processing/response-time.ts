/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import {
	type Attributes,
	metrics,
	SpanKind,
	SpanStatusCode,
	ValueType,
} from "@opentelemetry/api"
import { hrTimeToMilliseconds } from "@opentelemetry/core"
import {
	NoopSpanProcessor,
	type ReadableSpan,
	type SpanProcessor,
} from "@opentelemetry/sdk-trace"
import {
	ATTR_HTTP_REQUEST_METHOD,
	ATTR_HTTP_RESPONSE_STATUS_CODE,
} from "@opentelemetry/semantic-conventions"

import { ATTR_HTTP_METHOD, ATTR_HTTP_STATUS_CODE } from "../semattrs.old.ts"
import { componentLogger } from "../shared/logger.ts"
import { isRootOrEntry } from "./parent-span.ts"
import { TRANSACTION_NAME_ATTRIBUTE } from "./transaction-name.ts"

/**
 * Processor that records response time metrics.
 *
 * This should be registered after the transaction name processor as it depends on the final
 * transaction name being set on the span for the recorded metrics to be correlated with it.
 */
export class ResponseTimeProcessor extends NoopSpanProcessor implements SpanProcessor {
	readonly #logger = componentLogger(ResponseTimeProcessor)
	readonly #responseTime = metrics
		.getMeter("sw.apm.request.metrics")
		.createHistogram("trace.service.response_time", {
			valueType: ValueType.DOUBLE,
			unit: "ms",
			description:
				"Duration of each entry span for the service, typically meaning the time taken to process an inbound request.",
		})

	override onEnd(span: ReadableSpan): void {
		try {
			if (!isRootOrEntry(span)) {
				return
			}

			const time = hrTimeToMilliseconds(span.duration)
			const attributes: Attributes = {
				"sw.is_error": span.status.code === SpanStatusCode.ERROR,
			}

			const copy = [TRANSACTION_NAME_ATTRIBUTE]
			if (span.kind === SpanKind.SERVER) {
				/* oxlint-disable typescript/no-deprecated */
				copy.push(
					ATTR_HTTP_REQUEST_METHOD,
					ATTR_HTTP_RESPONSE_STATUS_CODE,
					ATTR_HTTP_METHOD,
					ATTR_HTTP_STATUS_CODE,
				)
				/* oxlint-enable typescript/no-deprecated */
			}
			for (const a of copy) {
				if (a in span.attributes) {
					attributes[a] = span.attributes[a]
				}
			}

			this.#logger.debug("recording response time", time, attributes)
			this.#responseTime.record(time, attributes)
		} catch (error) {
			this.#logger.error("failed to record response time", error)
		}
	}
}

/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import {
	NoopSpanProcessor,
	type ReadableSpan,
	type SpanProcessor,
} from "@opentelemetry/sdk-trace"
import { ATTR_CODE_STACKTRACE } from "@opentelemetry/semantic-conventions"
import { stacktrace } from "@solarwinds-apm/module"

import { type Configuration } from "../config.ts"
import { componentLogger } from "../shared/logger.ts"

export class StacktraceProcessor extends NoopSpanProcessor implements SpanProcessor {
	readonly #logger = componentLogger(StacktraceProcessor)
	readonly #filter?: (span: ReadableSpan) => number

	constructor(config: Configuration) {
		super()
		this.#filter = config.spanStacktraceFilter
	}

	override onEnd(span: ReadableSpan): void {
		try {
			const length = this.#filter?.(span) ?? 0
			if (length > 0) {
				span.attributes[ATTR_CODE_STACKTRACE] = stacktrace(length, false)
			}
		} catch (error) {
			this.#logger.error("failed to capture stacktrace", error)
		}
	}
}

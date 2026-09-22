/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { type Context, type Span, trace } from "@opentelemetry/api"
import {
	NoopSpanProcessor,
	type ReadableSpan,
	type SpanProcessor,
} from "@opentelemetry/sdk-trace"

import { spanStorage } from "../storage.ts"

/** Parent storage where false means no parent. */
const PARENT_STORAGE = spanStorage<Span | false>("parent")

/** Returns true if this span has no parent or its parent is remote. */
export function isRootOrEntry(span: Span | ReadableSpan): boolean {
	const parentSpan = PARENT_STORAGE.get(span)
	return parentSpan === false || parentSpan?.spanContext().isRemote === true
}

/** Traverses the span hierarchy until the root or entry is found. */
export function getRootOrEntry(span: Span): Span | undefined {
	let parentSpan = PARENT_STORAGE.get(span)

	while (parentSpan !== undefined) {
		if (parentSpan === false || parentSpan.spanContext().isRemote) {
			return span
		}

		span = parentSpan
		parentSpan = PARENT_STORAGE.get(span)
	}

	return undefined
}

/**
 * Processor that stores span parents.
 *
 * This should be the last registered processor since it will clear the stored parents during
 * {@link onEnd}, but other processors might want to access the parent during their
 * implementation of {@link SpanProcessor.onEnd}
 */
export class ParentSpanProcessor extends NoopSpanProcessor implements SpanProcessor {
	override onStart(span: Span, parentContext: Context): void {
		try {
			const parentSpan = trace.getSpan(parentContext)
			PARENT_STORAGE.set(span, parentSpan ?? false)
		} catch {
			return
		}
	}

	override onEnd(span: ReadableSpan): void {
		try {
			PARENT_STORAGE.delete(span)
		} catch {
			return
		}
	}
}

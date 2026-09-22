/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { trace } from "@opentelemetry/api"
import {
	NoopSpanProcessor,
	type ReadableSpan,
	type SpanProcessor,
} from "@opentelemetry/sdk-trace"
import { ATTR_HTTP_ROUTE, ATTR_URL_PATH } from "@opentelemetry/semantic-conventions"
import { unref } from "@solarwinds-apm/module"

import { environment } from "../env.ts"
import { ATTR_HTTP_TARGET } from "../semattrs.old.ts"
import { type Configuration } from "../shared/config.ts"
import { componentLogger } from "../shared/logger.ts"
import { getRootOrEntry, isRootOrEntry } from "./parent-span.ts"

export const TRANSACTION_NAME_ATTRIBUTE = "sw.transaction"

const TRANSACTION_NAME_POOL_TTL = 60 * 1000 // 1 minute
const TRANSACTION_NAME_POOL_MAX = 200
const TRANSACTION_NAME_MAX_LENGTH = 256
const TRANSACTION_NAME_DEFAULT = "other"

/**
 * Sets a custom name for the current transaction.
 *
 * @param name - Custom transaction name.
 * @returns Whether the name was successfully set
 */
export function setTransactionName(name: string): boolean {
	if (!name) {
		return false
	}

	const active = trace.getActiveSpan()
	const rootOrEntry = active && getRootOrEntry(active)
	if (!rootOrEntry) {
		return false
	}

	rootOrEntry.setAttribute(TRANSACTION_NAME_ATTRIBUTE, name)
	return true
}

/** Processor that sets the transaction name attribute on spans. */
export class TransactionNameProcessor extends NoopSpanProcessor implements SpanProcessor {
	readonly #logger = componentLogger(TransactionNameProcessor)
	readonly #pool = new TransactionNamePool({
		max: TRANSACTION_NAME_POOL_MAX,
		ttl: TRANSACTION_NAME_POOL_TTL,
		maxLength: TRANSACTION_NAME_MAX_LENGTH,
		default: TRANSACTION_NAME_DEFAULT,
	})
	readonly #defaultName?: (span: ReadableSpan) => string | undefined

	constructor(config: Configuration) {
		super()
		this.#defaultName = config.transactionName
	}

	override onEnd(span: ReadableSpan): void {
		try {
			if (!isRootOrEntry(span)) {
				return
			}

			let name = span.attributes[TRANSACTION_NAME_ATTRIBUTE]
			this.#logger.debug("initial transaction name", name, span.attributes)
			if (typeof name !== "string") {
				name = this.#defaultName?.(span) ?? computedTransactionName(span)
			}
			name = this.#pool.registered(name)
			this.#logger.debug("final transaction name", name)

			span.attributes[TRANSACTION_NAME_ATTRIBUTE] = name
		} catch (error) {
			this.#logger.error("failed to compute transaction name", error)
		}
	}
}

/** Computes a transaction name from a span and its attributes. */
export function computedTransactionName(span: ReadableSpan): string {
	// split on slashes and keep the first 3 segments
	// where the first segment is an empty string before the first slash
	// oxlint-disable-next-line unicorn/consistent-function-scoping
	const trim = (path: string) => path.split("/", 3).join("/")

	/* oxlint-disable typescript/no-deprecated */
	if (environment.SERVERLESS_NAME) {
		return environment.SERVERLESS_NAME
	} else if (typeof span.attributes[ATTR_HTTP_ROUTE] === "string") {
		return span.attributes[ATTR_HTTP_ROUTE]
	} else if (typeof span.attributes[ATTR_URL_PATH] === "string") {
		return trim(span.attributes[ATTR_URL_PATH])
	} else if (typeof span.attributes[ATTR_HTTP_TARGET] === "string") {
		return trim(span.attributes[ATTR_HTTP_TARGET])
	} else {
		return span.name
	}
	/* oxlint-enable typescript/no-deprecated */
}

/**
 * A pool that prevents explosion of cardinality in transaction names.
 *
 * The pool only allows a certain amount of transaction names to exist at any given moment. If
 * it is full, it will replace any name not already in the pool with a default one. The pool
 * frees up space by pruning names that haven't been used in a given amount of time.
 */
export class TransactionNamePool {
	readonly #pool = new Map<string, NodeJS.Timeout>()

	readonly #max: number
	readonly #ttl: number
	readonly #maxLength: number
	readonly #default: string

	constructor(options: { max: number; ttl: number; maxLength: number; default: string }) {
		this.#max = options.max
		this.#ttl = options.ttl
		this.#maxLength = options.maxLength
		this.#default = options.default
	}

	/** Given a desired transaction name return the one that should be used. */
	registered(name: string): string {
		name = name.slice(0, this.#maxLength)
		// new name and room in pool -> add name to pool and schedule for removal after ttl -> return name
		// new name but no room in pool -> return default name
		// existing name -> cancel previously scheduled removal -> schedule new removal -> return name

		const existing = this.#pool.get(name)
		if (existing !== undefined) {
			clearTimeout(existing)
		}

		if (existing !== undefined || this.#pool.size < this.#max) {
			const timeout = unref(setTimeout(() => this.#pool.delete(name), this.#ttl))
			this.#pool.set(name, timeout)
			return name
		} else {
			return this.#default
		}
	}
}

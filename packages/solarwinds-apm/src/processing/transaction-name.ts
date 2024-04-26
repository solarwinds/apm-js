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

import { trace } from "@opentelemetry/api"
import type * as sdk from "@opentelemetry/sdk-trace-base"
import {
  NoopSpanProcessor,
  type ReadableSpan,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace-base"
import {
  SEMATTRS_HTTP_ROUTE,
  SEMATTRS_HTTP_TARGET,
} from "@opentelemetry/semantic-conventions"
import { type SwConfiguration } from "@solarwinds-apm/sdk"

import { getRootOrEntry, isRootOrEntry } from "./parent-span.js"

const TRANSACTION_NAME_POOL_TTL = 60 * 1000 // 1 minute
const TRANSACTION_NAME_POOL_MAX = 200
const TRANSACTION_NAME_DEFAULT = "other"
const TRANSACTION_NAME_ATTRIBUTE = "sw.transaction"

export function setTransactionName(name: string): boolean {
  const active = trace.getActiveSpan()
  const rootOrEntry = active && getRootOrEntry(active)
  if (!rootOrEntry) {
    return false
  }

  rootOrEntry.setAttribute(TRANSACTION_NAME_ATTRIBUTE, name)
  return true
}

export class TransactionNameProcessor
  extends NoopSpanProcessor
  implements SpanProcessor
{
  readonly #pool = new TransactionNamePool({
    max: TRANSACTION_NAME_POOL_MAX,
    ttl: TRANSACTION_NAME_POOL_TTL,
    default: TRANSACTION_NAME_DEFAULT,
  })
  readonly #defaultName?: string

  constructor(config: SwConfiguration) {
    super()
    this.#defaultName = config.transactionName
  }

  override onEnd(span: ReadableSpan): void {
    if (!isRootOrEntry(span)) {
      return
    }

    let name = span.attributes[TRANSACTION_NAME_ATTRIBUTE]
    if (typeof name !== "string") {
      name = this.#defaultName ?? computedTransactionName(span)
    }
    name = this.#pool.registered(name)

    span.attributes[TRANSACTION_NAME_ATTRIBUTE] = name
  }
}

export function computedTransactionName(span: sdk.Span): string {
  if (typeof process.env.AWS_LAMBDA_FUNCTION_NAME === "string") {
    return process.env.AWS_LAMBDA_FUNCTION_NAME
  } else if (typeof span.attributes[SEMATTRS_HTTP_ROUTE] === "string") {
    return span.attributes[SEMATTRS_HTTP_ROUTE]
  } else if (typeof span.attributes[SEMATTRS_HTTP_TARGET] === "string") {
    // split on slashes and keep the first 3 segments
    // where the first segment is an empty string before the first slash
    return span.attributes[SEMATTRS_HTTP_TARGET].split("/", 3).join("/")
  } else {
    return span.name
  }
}

export class TransactionNamePool {
  readonly #pool = new Map<string, NodeJS.Timeout>()

  readonly #max: number
  readonly #ttl: number
  readonly #default: string

  constructor(options: { max: number; ttl: number; default: string }) {
    this.#max = options.max
    this.#ttl = options.ttl
    this.#default = options.default
  }

  registered(name: string): string {
    const existing = this.#pool.get(name)
    if (existing !== undefined) {
      clearTimeout(existing)
    }

    if (existing !== undefined || this.#pool.size < this.#max) {
      const timeout = setTimeout(
        () => this.#pool.delete(name),
        this.#ttl,
      ).unref()
      this.#pool.set(name, timeout)
      return name
    } else {
      return this.#default
    }
  }
}

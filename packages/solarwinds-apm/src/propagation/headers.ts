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
  type Context,
  type TextMapGetter,
  type TextMapPropagator,
  type TextMapSetter,
} from "@opentelemetry/api"
import type * as sampling from "@solarwinds-apm/sampling"

import { contextStorage } from "../storage.js"

/** SolarWinds headers */
export interface Headers {
  /** Headers to be extracted from incoming requests */
  request: sampling.RequestHeaders
  /** Headers to be injected into outgoing responses */
  response: sampling.ResponseHeaders
}

export type RequestHeader = keyof Headers["request"]
export type ResponseHeader = keyof Headers["response"]
export type Header = RequestHeader | ResponseHeader

/** Storage for headers inside the OTel Context */
export const HEADERS_STORAGE = contextStorage<Headers>("solarwinds-apm headers")

const X_TRACE_OPTIONS = "X-Trace-Options" satisfies Header
const X_TRACE_OPTIONS_RESPONSE = "X-Trace-Options-Response" satisfies Header
const X_TRACE_OPTIONS_SIGNATURE = "X-Trace-Options-Signature" satisfies Header

/**
 * Propagator that extracts SolarWinds request headers
 */
export class RequestHeadersPropagator implements TextMapPropagator<unknown> {
  extract(
    context: Context,
    carrier: unknown,
    getter: TextMapGetter<unknown>,
  ): Context {
    return HEADERS_STORAGE.set(context, {
      request: {
        [X_TRACE_OPTIONS]: joinIfArray(
          getter.get(carrier, X_TRACE_OPTIONS.toLowerCase()),
          ";",
        ),
        [X_TRACE_OPTIONS_SIGNATURE]: firstIfArray(
          getter.get(carrier, X_TRACE_OPTIONS_SIGNATURE.toLowerCase()),
        ),
      },
      response: {},
    })
  }

  inject(): void {
    return
  }

  fields(): RequestHeader[] {
    return [X_TRACE_OPTIONS, X_TRACE_OPTIONS_SIGNATURE]
  }
}

/**
 * Propagator that injects SolarWinds response headers
 *
 * This propagator SHOULD NOT be registered with the tracer provider
 * since it is meant for response and not request.
 * Currently it is registered in the HTTP instrumentation response hook
 * until an official response propagation API is added.
 */
export class ResponseHeadersPropagator implements TextMapPropagator<unknown> {
  inject(
    context: Context,
    carrier: unknown,
    setter: TextMapSetter<unknown>,
  ): void {
    const headers = HEADERS_STORAGE.get(context)?.response ?? {}
    for (const [name, value] of Object.entries(headers)) {
      if (!value) continue
      setter.set(carrier, name, value as string)
    }
  }

  fields(): ResponseHeader[] {
    return [X_TRACE_OPTIONS_RESPONSE]
  }

  extract(context: Context): Context {
    return context
  }
}

/**
 * Returns the first element if the value is an array
 * or the value as-is otherwise
 */
export function firstIfArray<T>(value: T | T[] | undefined): T | undefined {
  if (Array.isArray(value)) {
    return value[0]
  } else {
    return value
  }
}

/**
 * Returns the result of {@link Array.join} if the value is an array
 * or the value as-is otherwise
 *
 * @param separator - Separator used between elements
 */
export function joinIfArray(
  value: string | string[] | undefined,
  separator: string,
): string | undefined {
  if (Array.isArray(value)) {
    if (value.length > 0) {
      return value.join(separator)
    } else {
      return undefined
    }
  } else {
    return value
  }
}

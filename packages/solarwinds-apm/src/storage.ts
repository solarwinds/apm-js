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
  createContextKey,
  diag,
  type Span,
} from "@opentelemetry/api"
import * as sdk from "@opentelemetry/sdk-trace-base"

/**
 * Creates a global value shared between ESM and CommonJS contexts
 *
 * @param id - Descriptive unique ID for the global
 * @param init - Initializer for the global if it needs to be
 *
 * @returns Shared global
 */
export function global<const T>(id: string, init: () => T): T {
  const key = Symbol.for(`solarwinds-apm / ${id}`)
  let storage = Reflect.get(globalThis, key) as T | undefined

  if (!storage) {
    storage = init()
    Reflect.defineProperty(globalThis, key, {
      value: storage,
      configurable: false,
      enumerable: false,
      writable: false,
    })
  }

  return storage
}

/** Typed wrapper around the OTel {@link Context} API for a specific key */
export interface ContextStorage<T> {
  /**
   * Gets the value for the key
   *
   * Note that while the context object itself is immutable,
   * reference types stored in it are not. This means it is possible
   * to modify the return value of this function in-place if it is
   * a reference type.
   */
  get(context: Context): T | undefined
  /**
   * Sets the value for the key
   *
   * Note that the context object is immutable and this function
   * returns an updated context without modifying the given one in-place.
   * in-place
   */
  set(context: Context, value: T): Context
  /**
   * Deletes the value for the key
   *
   * Note that the context object is immutable and this function
   * returns an updated context without modifying the given one in-place.
   */
  delete(context: Context): Context
}

/**
 * Typed OTel {@link Span} attached storage API for a specific key
 *
 * This makes it possible to attach arbitrary data to OTel spans
 * without altering the span object.
 *
 * The stored value will be accessible throughout the entire
 * lifecycle of the span from the moment it is set until the span
 * finishes being exported.
 *
 * Unlike the previous implementation which used the span ID as a key
 * and needed to be carefully cleared at the right times to avoid leaking
 * memory, this uses a WeakMap with the span object itself as a key
 * which ensures the stored values are kept at least as long as they need
 * to be accessed.
 *
 * However it it still useful to manually clear unused entries to avoid
 * using up memory unnecessarily while waiting for the next GC cycle.
 */
export interface SpanStorage<T> {
  get(span: Span | sdk.Span | sdk.ReadableSpan): T | undefined
  set(span: Span | sdk.Span | sdk.ReadableSpan, value: T): boolean
  delete(span: Span | sdk.Span | sdk.ReadableSpan): boolean
}

const GLOBAL_SPAN_STORAGE = global(
  "span storage",
  () => new WeakMap<sdk.Span, Map<symbol, unknown>>(),
)

function withSdkSpan<T, const U>(
  span: Span | sdk.Span | sdk.ReadableSpan,
  fallback: U,
  f: (span: sdk.Span) => T,
): T | U {
  if (span instanceof sdk.Span) {
    return f(span)
  } else {
    diag.debug("span storage passed an invalid key", span)
    return fallback
  }
}

/** Creates a new {@link ContextStorage} for the given ID */
export function contextStorage<T>(id: string): ContextStorage<T> {
  const key = createContextKey(id)
  return {
    get: (ctx) => ctx.getValue(key) as T | undefined,
    set: (ctx, val) => ctx.setValue(key, val),
    delete: (ctx) => ctx.deleteValue(key),
  }
}

/** Creates a new {@link SpanStorage} for the given ID */
export function spanStorage<T>(id: string): SpanStorage<T> {
  const key = Symbol.for(id)

  return {
    get: (span) =>
      withSdkSpan(span, undefined, (span) => {
        return GLOBAL_SPAN_STORAGE.get(span)?.get(key) as T | undefined
      }),
    set: (span, val) =>
      withSdkSpan(span, false, (span) => {
        const storage =
          GLOBAL_SPAN_STORAGE.get(span) ?? new Map<symbol, unknown>()
        storage.set(key, val)
        GLOBAL_SPAN_STORAGE.set(span, storage)
        return true
      }),

    delete: (span) =>
      withSdkSpan(span, false, (span) => {
        const storage = GLOBAL_SPAN_STORAGE.get(span)
        if (!storage) {
          return false
        }

        const deleted = storage.delete(key)
        if (storage.size === 0) {
          GLOBAL_SPAN_STORAGE.delete(span)
        }

        return deleted
      }),
  }
}

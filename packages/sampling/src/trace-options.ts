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

import { hmac } from "@noble/hashes/hmac"
import { sha1 } from "@noble/hashes/sha1"
import { diag, type DiagLogger } from "@opentelemetry/api"

const TRIGGER_TRACE_KEY = "trigger-trace"
const TIMESTAMP_KEY = "ts"
const SW_KEYS_KEY = "sw-keys"

const CUSTOM_KEY_REGEX = /^custom-[^\s]+$/

export interface TraceOptions {
  triggerTrace?: true
  timestamp?: number
  swKeys?: string

  custom: Record<string, string>
  ignored: [string, string | undefined][]
}

export interface TraceOptionsResponse {
  auth?: Auth
  triggerTrace?: TriggerTrace
  ignored?: string[]
}

export interface RequestHeaders {
  "X-Trace-Options"?: string
  "X-Trace-Options-Signature"?: string
}

export interface ResponseHeaders {
  "X-Trace-Options-Response"?: string
}

export enum Auth {
  OK = "ok",
  BAD_TIMESTAMP = "bad-timestamp",
  BAD_SIGNATURE = "bad-signature",
  NO_SIGNATURE_KEY = "no-signature-key",
}

export enum TriggerTrace {
  OK = "ok",
  NOT_REQUESTED = "not-requested",
  IGNORED = "ignored",
  TRACING_DISABLED = "tracing-disabled",
  TRIGGER_TRACING_DISABLED = "trigger-tracing-disabled",
  RATE_EXCEEDED = "rate-exceeded",
  SETTINGS_NOT_AVAILABLE = "settings-not-available",
}

export function parseTraceOptions(
  header: string,
  logger: DiagLogger = diag,
): TraceOptions {
  const traceOptions: TraceOptions = {
    custom: {},
    ignored: [],
  }

  const kvs = header
    .split(";")
    .map<[string, string | undefined]>((kv) => {
      const [k, ...vs] = kv.split("=").map((s) => s.trim())
      return [k!, vs.length > 0 ? vs.join("=") : undefined]
    })
    .filter(([k]) => k.length > 0)

  for (const [k, v] of kvs) {
    if (k === TRIGGER_TRACE_KEY) {
      if (v !== undefined || traceOptions.triggerTrace !== undefined) {
        logger.debug(
          "invalid trace option for trigger trace, should not have a value and only be provided once",
        )

        traceOptions.ignored.push([k, v])
        continue
      }

      traceOptions.triggerTrace = true
    } else if (k === TIMESTAMP_KEY) {
      if (v === undefined || traceOptions.timestamp !== undefined) {
        logger.debug(
          "invalid trace option for timestamp, should have a value and only be provided once",
        )

        traceOptions.ignored.push([k, v])
        continue
      }

      const ts = Number.parseFloat(v)
      if (!Number.isSafeInteger(ts)) {
        logger.debug("invalid trace option for timestamp, should be an integer")

        traceOptions.ignored.push([k, v])
        continue
      }

      traceOptions.timestamp = ts
    } else if (k === SW_KEYS_KEY) {
      if (v === undefined || traceOptions.swKeys !== undefined) {
        logger.debug(
          "invalid trace option for sw keys, should have a value and only be provided once",
        )

        traceOptions.ignored.push([k, v])
        continue
      }

      traceOptions.swKeys = v
    } else if (CUSTOM_KEY_REGEX.test(k)) {
      if (v === undefined || traceOptions.custom[k] !== undefined) {
        logger.debug(
          `invalid trace option for custom key ${k}, should have a value and only be provided once`,
        )

        traceOptions.ignored.push([k, v])
        continue
      }

      traceOptions.custom[k] = v
    } else {
      traceOptions.ignored.push([k, v])
    }
  }

  return traceOptions
}

export function stringifyTraceOptionsResponse(
  traceOptionsResponse: TraceOptionsResponse,
): string {
  const kvs = {
    auth: traceOptionsResponse.auth,
    "trigger-trace": traceOptionsResponse.triggerTrace,
    ignored: traceOptionsResponse.ignored?.join(","),
  }

  return Object.entries(kvs)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v}`)
    .join(";")
}

export function validateSignature(
  header: string,
  signature: string,
  key: Uint8Array | undefined,
  timestamp: number | undefined,
): Auth {
  if (!key) {
    return Auth.NO_SIGNATURE_KEY
  }

  // unix seconds
  const now = Date.now() / 1000
  // timestamp must within 5 minutes
  if (!timestamp || Math.abs(now - timestamp) > 5 * 60) {
    return Auth.BAD_TIMESTAMP
  }

  const digest = hmac(sha1, key, header).reduce(
    (hex, byte) => hex + byte.toString(16).padStart(2, "0"),
    "",
  )

  if (signature === digest) {
    return Auth.OK
  } else {
    return Auth.BAD_SIGNATURE
  }
}

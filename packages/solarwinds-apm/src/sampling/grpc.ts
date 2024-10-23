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

import dns from "node:dns/promises"
import { hostname } from "node:os"
import { TextDecoder } from "node:util"

import { type CallOptions, Client, credentials, Metadata } from "@grpc/grpc-js"
import { context } from "@opentelemetry/api"
import { suppressTracing } from "@opentelemetry/core"
import { collector } from "@solarwinds-apm/proto"
import {
  type BucketSettings,
  BucketType,
  Flags,
  SampleSource,
  type Settings,
} from "@solarwinds-apm/sampling"

import { Backoff } from "../backoff.js"
import { type Configuration } from "../config.js"
import { componentLogger } from "../logger.js"
import { Sampler } from "./sampler.js"

const CLIENT_VERSION = "2"

const REQUEST_TIMEOUT = 10 * 1000 // 10s
const RETRY_INITIAL_TIMEOUT = 500 // 500ms
const RETRY_MAX_TIMEOUT = 60 * 1000 // 60s
const RETRY_MAX_ATTEMPTS = 20
const MULTIPLIER = 1.5

/** Map of flag names to their value */
const FLAGS_NAMES: Record<string, Flags | undefined> = {
  OVERRIDE: Flags.OVERRIDE,
  SAMPLE_START: Flags.SAMPLE_START,
  SAMPLE_THROUGH_ALWAYS: Flags.SAMPLE_THROUGH_ALWAYS,
  TRIGGER_TRACE: Flags.TRIGGERED_TRACE,
}

const BUCKET_CAPACITY = "BucketCapacity"
const BUCKET_RATE = "BucketRate"
const TRIGGER_RELAXED_BUCKET_CAPACITY = "TriggerRelaxedBucketCapacity"
const TRIGGER_RELAXED_BUCKET_RATE = "TriggerRelaxedBucketRate"
const TRIGGER_STRICT_BUCKET_CAPACITY = "TriggerStrictBucketCapacity"
const TRIGGER_STRICT_BUCKET_RATE = "TriggerStrictBucketRate"
const SIGNATURE_KEY = "SignatureKey"

/** Sampler that retrieves settings from the SWO collector directly via gRPC */
export class GrpcSampler extends Sampler {
  readonly #key: string
  readonly #address: URL
  readonly #hostname = hostname()
  readonly #backoff = new Backoff({
    initial: RETRY_INITIAL_TIMEOUT,
    max: RETRY_MAX_TIMEOUT,
    retries: RETRY_MAX_ATTEMPTS,
    multiplier: MULTIPLIER,
  })

  #client: CollectorClient
  #lastWarningMessage: string | undefined = undefined

  constructor(config: Configuration) {
    super(config, componentLogger(GrpcSampler))

    this.#key = `${config.serviceKey?.token}:${config.service}`

    // convert the collector string into a valid full URL
    let collector = config.collector
    if (!/:{0-9}+$/.test(collector)) {
      collector = `${collector}:443`
    }
    if (!/^https?:/.test(collector)) {
      collector = `https://${collector}`
    }

    const invalidCollectorClient = (cause?: unknown): CollectorClient => ({
      getSettings: () =>
        Promise.reject(
          new Error(`Invalid collector "${config.collector}"`, { cause }),
        ),
    })

    try {
      this.#address = new URL(collector)

      // on Alpine the grpc.Client constructor will hang forever if the hostname can't resolve
      // to avoid this we try to resolve before actually instantiating it. if it doesn't resolve
      // we instead use a dummy client which always rejects and informs the user
      const resolve = Promise.any([
        dns.resolve4(this.#address.hostname),
        dns.resolve6(this.#address.hostname),
      ])
        .then(() => {
          const cred = config.trustedpath
            ? credentials.createSsl(Buffer.from(config.trustedpath))
            : credentials.createSsl()
          this.#client = new GrpcCollectorClient(this.#address.host, cred)
        })
        .catch((cause: unknown) => {
          this.#client = invalidCollectorClient(cause)
        })

      // create a temporary client that waits until the real one is instantiated
      // then forwards the call to it
      this.#client = {
        getSettings: (request, response) =>
          resolve.then(() => this.#client.getSettings(request, response)),
      }
    } catch (cause) {
      // this should only happen if the collector setting is set to something nonsensical
      this.#address = new URL("https://collector.invalid:443")
      this.#client = invalidCollectorClient(cause)
    }

    setImmediate(() => {
      this.#loop()
    }).unref()
  }

  override toString(): string {
    return `gRPC Sampler (${this.#address.host})`
  }

  /** Logs a de-duplicated warning */
  #warn(message: string, ...args: unknown[]) {
    if (message !== this.#lastWarningMessage) {
      this.logger.warn(message, ...args)
      this.#lastWarningMessage = message
    } else {
      this.logger.debug(message, ...args)
    }
  }
  /** Resets last memorised warning */
  #resetWarn() {
    this.#lastWarningMessage = undefined
  }

  #loop() {
    const retry = () => {
      const timeout = this.#backoff.backoff()
      if (timeout) {
        this.logger.debug(`retrying in ${(timeout / 1000).toFixed(1)}s`)
        setTimeout(() => {
          this.#loop()
        }, timeout).unref()
      } else {
        this.logger.warn(
          "Reached max retry attempts for sampling settings retrieval.",
          "Tracing will remain disabled.",
        )
      }
    }

    this.logger.debug("retrieving sampling settings")
    this.#client
      .getSettings(
        {
          apiKey: this.#key,
          identity: { hostname: this.#hostname },
          clientVersion: CLIENT_VERSION,
        },
        { options: { deadline: Date.now() + REQUEST_TIMEOUT } },
      )
      .then((response) => {
        if (!response) {
          this.logger.debug("empty response from collector")
          retry()
          return
        }

        this.logger.debug("retrieved sampling settings", response)
        if (response.warning) {
          this.#warn(response.warning)
        }

        if (
          response.result === collector.ResultCode.TRY_LATER ||
          response.result === collector.ResultCode.LIMIT_EXCEEDED
        ) {
          this.logger.debug("collector asked to retry later")
          retry()
          return
        } else if (response.result !== collector.ResultCode.OK) {
          this.logger.debug("collector returned error status", response.result)
          retry()
          return
        }

        const unparsed = response.settings?.find(
          ({ type }) => type === collector.OboeSettingType.DEFAULT_SAMPLE_RATE,
        )
        const parsed = unparsed && parseSettings(unparsed)
        if (!parsed) {
          this.#warn(
            "Retrieved sampling settings are invalid.",
            "If you are connecting to an AppOptics collector please set the 'SW_APM_LEGACY' environment variable.",
          )
          retry()
          return
        }

        this.updateSettings(parsed)
        this.#backoff.reset()
        this.#resetWarn()

        // this is pretty arbitrary but the goal is to update the settings
        // before the previous ones expire with some time to spare
        const timeout = parsed.ttl * 1000 - REQUEST_TIMEOUT * MULTIPLIER
        setTimeout(
          () => {
            this.#loop()
          },
          Math.max(0, timeout),
        ).unref()
      })
      .catch((error: unknown) => {
        let message = "Failed to retrieve sampling settings"
        if (error instanceof Error) {
          message += ` (${error.message})`
        }
        message += ", tracing will be disabled until valid ones are available"
        this.#warn(message, error)

        retry()
      })
  }
}

export interface CollectorRequestOptions {
  /** gRPC metadata */
  metadata?: Metadata
  /** gRPC call options */
  options?: CallOptions
  /** Optional abort signal */
  signal?: AbortSignal
}

interface CollectorClient {
  getSettings(
    request: collector.ISettingsRequest,
    options?: CollectorRequestOptions,
  ): Promise<collector.ISettingsResult | undefined>
}

/** gRPC client for the SWO collector */
export class GrpcCollectorClient extends Client implements CollectorClient {
  getSettings(
    request: collector.ISettingsRequest,
    options: CollectorRequestOptions = {},
  ): Promise<collector.ISettingsResult | undefined> {
    return new Promise((resolve, reject) => {
      context.with(suppressTracing(context.active()), () => {
        const call = this.makeUnaryRequest<
          collector.ISettingsRequest,
          collector.ISettingsResult
        >(
          "/collector.TraceCollector/getSettings",
          (req) => Buffer.from(collector.SettingsRequest.encode(req).finish()),
          (res) => collector.SettingsResult.decode(res),
          request,

          options.metadata ?? new Metadata(),
          options.options ?? {},

          (err, res) => {
            if (err) reject(err)
            else resolve(res)
          },
        )

        options.signal?.addEventListener("abort", () => {
          call.cancel()
        })
      })
    })
  }
}

/** Converts settings received from the gRPC collector into the internal representation */
export function parseSettings(
  unparsed: collector.IOboeSetting,
): Settings | undefined {
  if (!unparsed.timestamp || !unparsed.ttl) {
    return undefined
  }

  const settings: Settings = {
    sampleRate: unparsed.value ?? 0,
    sampleSource: SampleSource.Remote,
    flags: Flags.OK,
    buckets: {},
    timestamp: unparsed.timestamp,
    ttl: unparsed.ttl,
  }
  const decoder = new TextDecoder("utf-8", { fatal: false })

  const flagNames = decoder.decode(unparsed.flags ?? new Uint8Array([]))
  for (const flagName of flagNames.split(",")) {
    const flagValue = FLAGS_NAMES[flagName]
    if (flagValue != undefined) {
      settings.flags |= flagValue
    }
  }

  for (const [key, value] of Object.entries(unparsed.arguments ?? {})) {
    switch (key) {
      case BUCKET_CAPACITY: {
        parseBucketSetting(settings, BucketType.DEFAULT, "capacity", value)
        break
      }
      case BUCKET_RATE: {
        parseBucketSetting(settings, BucketType.DEFAULT, "rate", value)
        break
      }
      case TRIGGER_RELAXED_BUCKET_CAPACITY: {
        parseBucketSetting(
          settings,
          BucketType.TRIGGER_RELAXED,
          "capacity",
          value,
        )
        break
      }
      case TRIGGER_RELAXED_BUCKET_RATE: {
        parseBucketSetting(settings, BucketType.TRIGGER_RELAXED, "rate", value)
        break
      }
      case TRIGGER_STRICT_BUCKET_CAPACITY: {
        parseBucketSetting(
          settings,
          BucketType.TRIGGER_STRICT,
          "capacity",
          value,
        )
        break
      }
      case TRIGGER_STRICT_BUCKET_RATE: {
        parseBucketSetting(settings, BucketType.TRIGGER_STRICT, "rate", value)
        break
      }
      case SIGNATURE_KEY: {
        settings.signatureKey = value
      }
    }
  }

  return settings
}

function parseBucketSetting(
  settings: Settings,
  type: BucketType,
  key: keyof BucketSettings,
  value: Uint8Array,
): void {
  const bucket = settings.buckets[type] ?? { capacity: 0, rate: 0 }
  try {
    const parsed = Buffer.from(value).readDoubleLE()
    bucket[key] = parsed
    settings.buckets[type] = bucket
  } catch {
    return
  }
}

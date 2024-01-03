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

export declare const SETTINGS_VERSION: number
export declare const SETTINGS_MAGIC_NUMBER: number
export declare const SETTINGS_TYPE_DEFAULT_SAMPLE_RATE: number
export declare const SETTINGS_TYPE_LAYER_SAMPLE_RATE: number
export declare const SETTINGS_TYPE_LAYER_APP_SAMPLE_RATE: number
export declare const SETTINGS_TYPE_LAYER_HTTPHOST_SAMPLE_RATE: number
export declare const SETTINGS_TYPE_CONFIG_STRING: number
export declare const SETTINGS_TYPE_CONFIG_INT: number
export declare const SETTINGS_FLAG_OK: number
export declare const SETTINGS_FLAG_INVALID: number
export declare const SETTINGS_FLAG_OVERRIDE: number
export declare const SETTINGS_FLAG_SAMPLE_START: number
export declare const SETTINGS_FLAG_SAMPLE_THROUGH: number
export declare const SETTINGS_FLAG_SAMPLE_THROUGH_ALWAYS: number
export declare const SETTINGS_FLAG_TRIGGERED_TRACE: number
export declare const SETTINGS_MAX_STRLEN: number

export declare const SETTINGS_UNSET: number

export declare const SAMPLE_RATE_SOURCE_FILE: number
export declare const SAMPLE_RATE_SOURCE_DEFAULT: number
export declare const SAMPLE_RATE_SOURCE_OBOE: number
export declare const SAMPLE_RATE_SOURCE_LAST_OBOE: number
export declare const SAMPLE_RATE_SOURCE_DEFAULT_MISCONFIGURED: number
export declare const SAMPLE_RATE_SOURCE_OBOE_DEFAULT: number
export declare const SAMPLE_RATE_SOURCE_CUSTOM: number

export declare const SAMPLE_RESOLUTION: number

export declare const TRACE_DISABLED: number
export declare const TRACE_ENABLED: number
export declare const TRIGGER_DISABLED: number
export declare const TRIGGER_ENABLED: number

export declare const SEND_EVENT: number
export declare const SEND_STATUS: number
export declare const SEND_PROFILING: number

export declare const SERVER_RESPONSE_UNKNOWN: number
export declare const SERVER_RESPONSE_OK: number
export declare const SERVER_RESPONSE_TRY_LATER: number
export declare const SERVER_RESPONSE_LIMIT_EXCEEDED: number
export declare const SERVER_RESPONSE_CONNECT_ERROR: number

export declare const SPAN_NULL_PARAMS: number
export declare const SPAN_NULL_BUFFER: number
export declare const SPAN_INVALID_VERSION: number
export declare const SPAN_NO_REPORTER: number
export declare const SPAN_NOT_READY: number

export declare const TRACING_DECISIONS_FAILED_AUTH: number
export declare const TRACING_DECISIONS_TRIGGERED_TRACE_EXHAUSTED: number
export declare const TRACING_DECISIONS_TRIGGERED_TRACE_DISABLED: number
export declare const TRACING_DECISIONS_TRACING_DISABLED: number
export declare const TRACING_DECISIONS_XTRACE_NOT_SAMPLED: number
export declare const TRACING_DECISIONS_OK: number
export declare const TRACING_DECISIONS_NULL_OUT: number
export declare const TRACING_DECISIONS_NO_CONFIG: number
export declare const TRACING_DECISIONS_REPORTER_NOT_READY: number
export declare const TRACING_DECISIONS_NO_VALID_SETTINGS: number
export declare const TRACING_DECISIONS_QUEUE_FULL: number
export declare const TRACING_DECISIONS_BAD_ARG: number

export declare const TRACING_DECISIONS_AUTH_NOT_CHECKED: number
export declare const TRACING_DECISIONS_AUTH_NOT_PRESENT: number
export declare const TRACING_DECISIONS_AUTH_OK: number
export declare const TRACING_DECISIONS_AUTH_NO_SIG_KEY: number
export declare const TRACING_DECISIONS_AUTH_INVALID_SIG: number
export declare const TRACING_DECISIONS_AUTH_BAD_TIMESTAMP: number

export declare const REQUEST_TYPE_NONE: number
export declare const REQUEST_TYPE_REGULAR: number
export declare const REQUEST_TYPE_TRIGGER: number

export declare const INIT_OPTIONS_SET_DEFAULTS_OK: number
export declare const INIT_OPTIONS_SET_DEFAULTS_WRONG_VERSION: number

export declare const INIT_ALREADY_INIT: number
export declare const INIT_OK: number
export declare const INIT_WRONG_VERSION: number
export declare const INIT_INVALID_PROTOCOL: number
export declare const INIT_NULL_REPORTER: number
export declare const INIT_DESC_ALLOC: number
export declare const INIT_FILE_OPEN_LOG: number
export declare const INIT_UDP_NO_SUPPORT: number
export declare const INIT_UDP_OPEN: number
export declare const INIT_SSL_CONFIG_AUTH: number
export declare const INIT_SSL_LOAD_CERT: number
export declare const INIT_SSL_REPORTER_CREATE: number
export declare const INIT_SSL_MISSING_KEY: number

export declare const CUSTOM_METRICS_OK: number
export declare const CUSTOM_METRICS_INVALID_COUNT: number
export declare const CUSTOM_METRICS_INVALID_REPORTER: number
export declare const CUSTOM_METRICS_TAG_LIMIT_EXCEEDED: number
export declare const CUSTOM_METRICS_STOPPING: number
export declare const CUSTOM_METRICS_QUEUE_LIMIT_EXCEEDED: number

export declare const REPORTER_FLUSH_OK: number
export declare const REPORTER_FLUSH_METRIC_ERROR: number
export declare const REPORTER_FLUSH_BAD_UTF8: number
export declare const REPORTER_FLUSH_NO_REPORTER: number
export declare const REPORTER_FLUSH_REPORTER_NOT_READY: number

export declare const INIT_LOG_LEVEL_FATAL: number
export declare const INIT_LOG_LEVEL_ERROR: number
export declare const INIT_LOG_LEVEL_WARNING: number
export declare const INIT_LOG_LEVEL_INFO: number
export declare const INIT_LOG_LEVEL_DEBUG: number
export declare const INIT_LOG_LEVEL_PREVIOUS_MEDIUM: number
export declare const INIT_LOG_LEVEL_TRACE: number

export declare const INIT_LOG_TYPE_STDERR: number
export declare const INIT_LOG_TYPE_STDOUT: number
export declare const INIT_LOG_TYPE_FILE: number
export declare const INIT_LOG_TYPE_NULL: number
export declare const INIT_LOG_TYPE_DISABLE: number

export declare function debug_log_add(
  logger: (
    level: number,
    source_name: string | null,
    source_lineno: number,
    msg: string,
  ) => void,
  level: number,
): number

export interface DecisionOptions {
  in_xtrace?: string | null
  tracestate?: string | null
  custom_tracing_mode?: number
  custom_sample_rate?: number
  request_type?: number
  custom_trigger_mode?: number
  header_options?: string | null
  header_signature?: string | null
  header_timestamp?: number | bigint
}
export interface DecisionResult {
  do_metrics: number
  do_sample: number
  sample_rate: number
  sample_source: number
  bucket_rate: number
  bucket_cap: number
  type: number
  auth: number
  status_msg: string
  auth_msg: string
  status: number
}

export declare class Metadata {
  private constructor()

  createEvent(): Event

  copy(): Metadata
  isValid(): boolean
  isSampled(): boolean

  static makeRandom(sampled?: boolean): Metadata
  static fromString(s: string): Metadata

  toString(): string
}

export declare namespace Context {
  function setTracingMode(newMode: number): void

  function setTriggerMode(newMode: number): void

  function setDefaultSampleRate(newRate: number): void

  function getDecisions(options: DecisionOptions): DecisionResult

  function get(): Metadata

  function toString(): string

  function set(metadata: Metadata): void

  function fromString(s: string): void

  function copy(): Metadata

  function setSampledFlag(): void

  function clear(): void

  function isValid(): boolean

  function isSampled(): boolean

  function validateTransformServiceName(service_key: string): string

  function shutdown(): void

  function isReady(timeout: number): number

  function isLambda(): boolean

  function createEvent(timestamp?: number | bigint): Event
  function startTrace(): Event

  function createEntry(
    md: Metadata,
    timestamp: number | bigint,
    parent_md?: Metadata,
  ): Event
  function createExit(timestamp: number | bigint): Event
}

export declare class Event {
  private constructor()

  addInfo(key: string, value: null | string | number | boolean): boolean

  addEdge(md: Metadata): boolean
  addContextOpId(md: Metadata): boolean

  addHostname(): boolean

  getMetadata(): Metadata
  metadataString(): string
  opIdString(): string

  send(with_system_timestamp?: boolean): boolean

  sendProfiling(): boolean

  addSpanRef(md: Metadata): boolean
  addProfileEdge(id: string): boolean

  static startTrace(md: Metadata): Event
}

export declare namespace Span {
  interface SpanOptions {
    transaction: string | null
    domain: string | null
    duration: number | bigint
    has_error: number
    service_name?: string | null
  }
  function createSpan(options: SpanOptions): string

  interface HttpSpanOptions {
    transaction: string | null
    url: string | null
    domain: string | null
    duration: number | bigint
    status: number
    method: string | null
    has_error: number
    service_name?: string | null
  }
  function createHttpSpan(options: HttpSpanOptions): string
}

export declare class MetricTags {
  constructor(count: number)
  add(index: number, key: string, value: string): boolean
}

export declare namespace CustomMetrics {
  interface SummaryOptions {
    name: string
    value: number
    count: number
    host_tag: number
    service_name: string | null
    tags: MetricTags
    tags_count: number
  }
  function summary(options: SummaryOptions): number

  interface IncrementOptions {
    name: string
    count: number
    host_tag: number
    service_name: string | null
    tags: MetricTags
    tags_count: number
  }
  function increment(options: IncrementOptions): number
}

export interface ReporterOptions {
  hostname_alias: string
  log_level: number
  log_file_path: string

  max_transactions: number
  max_flush_wait_time: number
  events_flush_interval: number
  max_request_size_bytes: number

  reporter: string
  host: string
  service_key: string
  certificates: string

  buffer_size: number
  trace_metrics: number
  histogram_precision: number
  token_bucket_capacity: number
  token_bucket_rate: number
  file_single: number

  ec2_metadata_timeout: number
  grpc_proxy: string
  stdout_clear_nonblocking: number
  metric_format: number

  log_type: number
}
export declare class Reporter {
  constructor(options: ReporterOptions)

  get init_status(): number

  sendReport(evt: Event, with_system_timestamp?: boolean): number
  sendReport(evt: Event, md: Metadata, with_system_timestamp?: boolean): number
  sendStatus(evt: Event, with_system_timestamp?: boolean): number
  sendStatus(evt: Event, md: Metadata, with_system_timestamp?: boolean): number
  flush(): void
  getType(): string
}

export declare namespace Config {
  function checkVersion(version: number, revision: number): boolean
  function getVersionString(): string
}

export interface LoggingOptions {
  level: number
  type: number
}

export interface OboeAPIOptions {
  logging_options: LoggingOptions
}

export declare class OboeAPI {
  constructor(options: OboeAPIOptions)

  getTracingDecision(options: DecisionOptions): DecisionResult

  consumeRequestCount(): number | false
  consumeTokenBucketExhaustionCount(): number | false
  consumeTraceCount(): number | false
  consumeSampleCount(): number | false
  consumeThroughTraceCount(): number | false
  consumeTriggeredTraceCount(): number | false
  getLastUsedSampleRate(): number | false
  getLastUsedSampleSource(): number | false
}

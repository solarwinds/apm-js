import {
  type DiagLogFunction,
  type DiagLogger,
  DiagLogLevel,
} from "@opentelemetry/api"
import { oboe } from "@swotel/bindings"
import { type SwoConfiguration } from "@swotel/sdk"

export function createReporter(config: SwoConfiguration): oboe.Reporter {
  return new oboe.Reporter({
    service_key: config.serviceKey,
    host: config.collector ?? "",
    certificates: config.certificate ?? "",

    hostname_alias: "",
    log_level: otelLevelToOboe(config.logLevel ?? DiagLogLevel.INFO),
    log_file_path: "",

    max_transactions: -1,
    max_flush_wait_time: -1,
    events_flush_interval: -1,
    max_request_size_bytes: -1,

    reporter: "",

    buffer_size: -1,
    trace_metrics: 1,
    histogram_precision: -1,
    token_bucket_capacity: -1,
    token_bucket_rate: -1,
    file_single: 0,

    ec2_metadata_timeout: -1,
    grpc_proxy: "",
    stdout_clear_nonblocking: 0,
    metric_format: config.metricFormat ?? 0,
  })
}

export function otelLevelToOboe(level?: DiagLogLevel): number {
  switch (level) {
    case DiagLogLevel.NONE:
      return oboe.DEBUG_DISABLED
    case DiagLogLevel.ERROR:
      return oboe.DEBUG_ERROR
    case DiagLogLevel.WARN:
      return oboe.DEBUG_WARNING
    case DiagLogLevel.INFO:
      return oboe.DEBUG_INFO
    case DiagLogLevel.DEBUG:
      return oboe.DEBUG_LOW
    case DiagLogLevel.VERBOSE:
      return oboe.DEBUG_MEDIUM
    case DiagLogLevel.ALL:
      return oboe.DEBUG_HIGH
    default:
      return oboe.DEBUG_INFO
  }
}

export function oboeLevelToLogger(
  level: number,
  logger: DiagLogger,
): DiagLogFunction {
  switch (level) {
    case oboe.DEBUG_ERROR:
      return logger.error.bind(logger)
    case oboe.DEBUG_WARNING:
      return logger.warn.bind(logger)
    case oboe.DEBUG_INFO:
      return logger.info.bind(logger)
    case oboe.DEBUG_LOW:
      return logger.debug.bind(logger)
    default:
      return logger.verbose.bind(logger)
  }
}

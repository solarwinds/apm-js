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
  diag,
  type DiagLogFunction,
  type DiagLogger,
  DiagLogLevel,
} from "@opentelemetry/api"
import { oboe } from "@solarwinds-apm/bindings"
import { type SwConfiguration } from "@solarwinds-apm/sdk"

import certificate from "./certificate.js"

export function reporter(config: SwConfiguration): oboe.Reporter {
  const reporter = new oboe.Reporter({
    service_key: `${config.token}:${config.serviceName}`,
    host: config.collector ?? "",
    certificates: config.certificate ?? certificate,
    grpc_proxy: config.proxy ?? "",
    reporter: "ssl",
    metric_format: 1,
    trace_metrics: 1,

    log_level: otelLevelToOboeLevel(config.otelLogLevel),
    log_type: otelLevelToOboeType(config.otelLogLevel),
    log_file_path: "",

    buffer_size: oboe.SETTINGS_UNSET,
    ec2_metadata_timeout: oboe.SETTINGS_UNSET,
    events_flush_interval: oboe.SETTINGS_UNSET,
    file_single: 0,
    histogram_precision: oboe.SETTINGS_UNSET,
    hostname_alias: "",
    max_flush_wait_time: oboe.SETTINGS_UNSET,
    max_request_size_bytes: oboe.SETTINGS_UNSET,
    max_transactions: oboe.SETTINGS_UNSET,
    stdout_clear_nonblocking: 0,
    token_bucket_capacity: oboe.SETTINGS_UNSET,
    token_bucket_rate: oboe.SETTINGS_UNSET,
  })

  const logger = diag.createComponentLogger({
    namespace: `[sw/oboe]`,
  })
  oboe.debug_log_add((level, sourceName, sourceLine, message) => {
    const log = oboeLevelToOtelLogger(level, logger)

    // Log source locations for anything more verbose than info and
    // anything above warning level
    if (sourceName && (level < 2 || level > 3)) {
      const source = { source: sourceName, line: sourceLine }
      log(message, source)
    } else {
      log(message)
    }
  }, config.oboeLogLevel)

  return reporter
}

function otelLevelToOboeLevel(level: DiagLogLevel): number {
  switch (level) {
    case DiagLogLevel.NONE:
      return oboe.INIT_LOG_LEVEL_FATAL
    case DiagLogLevel.ERROR:
      return oboe.INIT_LOG_LEVEL_ERROR
    case DiagLogLevel.WARN:
      return oboe.INIT_LOG_LEVEL_WARNING
    case DiagLogLevel.INFO:
      return oboe.INIT_LOG_LEVEL_INFO
    case DiagLogLevel.DEBUG:
      return oboe.INIT_LOG_LEVEL_DEBUG
    case DiagLogLevel.VERBOSE:
    case DiagLogLevel.ALL:
    default:
      return oboe.INIT_LOG_LEVEL_TRACE
  }
}

function otelLevelToOboeType(level: DiagLogLevel): number {
  if (level === DiagLogLevel.NONE) return oboe.INIT_LOG_TYPE_DISABLE
  else return oboe.INIT_LOG_TYPE_NULL
}

// https://github.com/boostorg/log/blob/boost-1.82.0/include/boost/log/trivial.hpp#L42-L50
function oboeLevelToOtelLogger(
  level: number,
  logger: DiagLogger,
): DiagLogFunction {
  switch (level) {
    case 0:
      return logger.verbose.bind(logger)
    case 1:
      return logger.debug.bind(logger)
    case 2:
      return logger.info.bind(logger)
    case 3:
      return logger.warn.bind(logger)
    case 4:
    case 5:
    default:
      return logger.error.bind(logger)
  }
}

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

import {
  type Attributes,
  type DiagLogFunction,
  type DiagLogger,
  DiagLogLevel,
} from "@opentelemetry/api"
import { type Resource } from "@opentelemetry/resources"
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions"
import {
  ATTR_PROCESS_COMMAND_ARGS,
  ATTR_PROCESS_COMMAND_LINE,
} from "@opentelemetry/semantic-conventions/incubating"
import { oboe } from "@solarwinds-apm/bindings"

import { type Configuration } from "../config.js"
import { modules, VERSIONS } from "../metadata.js"
import { componentLogger } from "../shared/logger.js"
import { VERSION } from "../version.js"
import certificate from "./certificate.js"

export const ERROR: Error | undefined = oboe instanceof Error ? oboe : undefined

export async function reporter(
  config: Configuration,
  resource: Resource,
): Promise<oboe.Reporter> {
  const reporter = new oboe.Reporter({
    service_key: `${config.token}:${config.service}`,
    host: config.collector.hostname,
    certificates: config.trustedpath ?? (config.appoptics ? certificate : ""),
    grpc_proxy: config.proxy ?? "",
    reporter: "ssl",
    metric_format: config.appoptics ? 1 : 2,
    trace_metrics: 1,

    log_level: otelLevelToOboeLevel(config.logLevel),
    log_type: otelLevelToOboeType(config.logLevel),
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

  const logger = componentLogger({ name: "liboboe.so" })
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
  }, otelLevelToOboeLevel(config.logLevel))

  // Send init message
  const md = oboe.Metadata.makeRandom(true)
  oboe.Context.set(md)
  const event = md.createEvent()
  for (const [key, value] of await init(resource)) {
    event.addInfo(key, value)
  }
  reporter.sendStatus(event)

  return reporter
}

export async function init(
  resource: Resource,
): Promise<[string, string | number | boolean | null][]> {
  return Object.entries<Attributes>({
    ...(await modules()),
    ...VERSIONS,
    ...resource.attributes,

    __Init: true,
    Layer: "nodejs",
    Label: "single",

    "APM.Version": VERSION,
    "APM.Extension.Version": oboe.Config.getVersionString(),
  })
    .map(([name, value]): [string, string | number | boolean | null] => {
      if (name == ATTR_PROCESS_COMMAND_ARGS && Array.isArray(value)) {
        return [ATTR_PROCESS_COMMAND_LINE, value.join(" ")]
      } else if (Array.isArray(value)) {
        return [name, value.join(", ")]
      } else {
        return [name, value ?? null]
      }
    })
    .filter(([name]) => name !== ATTR_SERVICE_NAME)
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

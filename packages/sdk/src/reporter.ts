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

import * as process from "node:process"

import { type AttributeValue } from "@opentelemetry/api"
import { type Resource } from "@opentelemetry/resources"
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions"
import { oboe } from "@solarwinds-apm/bindings"
import { dependencies } from "@solarwinds-apm/dependencies"
import * as semver from "semver"

import packageJson from "../package.json"
import { type SwConfiguration } from "./config"

export function createReporter(config: SwConfiguration): oboe.Reporter {
  return new oboe.Reporter({
    service_key: `${config.token}:${config.serviceName}`,
    host: config.collector ?? "",
    certificates: config.certificate ?? "",

    hostname_alias: "",
    log_level: config.oboeLogLevel,
    log_file_path: "",

    max_transactions: -1,
    max_flush_wait_time: -1,
    events_flush_interval: -1,
    max_request_size_bytes: -1,

    reporter: "ssl",

    buffer_size: -1,
    trace_metrics: 1,
    histogram_precision: -1,
    token_bucket_capacity: -1,
    token_bucket_rate: -1,
    file_single: 0,

    ec2_metadata_timeout: -1,
    grpc_proxy: config.proxy ?? "",
    stdout_clear_nonblocking: 0,
    metric_format: config.metricFormat ?? 2,

    log_type: oboe.INIT_LOG_TYPE_NULL,
  })
}

export function createServerlessApi(config: SwConfiguration): oboe.OboeAPI {
  return new oboe.OboeAPI({
    logging_options: {
      level: config.oboeLogLevel,
      type: oboe.INIT_LOG_TYPE_NULL,
    },
  })
}

export async function initMessage(
  resource: Resource,
  version: string,
): Promise<Record<string, string | number | boolean>> {
  const libsVersions = Object.fromEntries(
    Object.entries(process.versions)
      .filter(([name]) => name !== "node")
      .map(([name, version]) => [`Node.${name}.Version`, version!]),
  )

  const deps = await dependencies()
  const depsVersions = Object.fromEntries(
    [...deps].map(([name, versions]) => [
      `Node.${name}.Version`,
      [...versions].sort(semver.compare).join(", "),
    ]),
  )

  const resourceAttributes = Object.fromEntries(
    Object.entries(resource.attributes)
      .map<[string, AttributeValue | undefined]>(([name, value]) =>
        name === SemanticResourceAttributes.PROCESS_COMMAND_ARGS
          ? [
              SemanticResourceAttributes.PROCESS_COMMAND_LINE,
              (value as string[]).join(" "),
            ]
          : [name, value],
      )
      .filter(
        ([name, value]) =>
          name !== SemanticResourceAttributes.SERVICE_NAME &&
          value !== undefined &&
          !Array.isArray(value),
      ),
  )

  return {
    ...depsVersions,
    ...libsVersions,
    ...resourceAttributes,

    __Init: true,
    Layer: "nodejs",
    Label: "single",

    // `<solarwinds-apm>+<@solarwinds-apm/sdk>`
    "APM.Version": `${version}+${packageJson.version}`,
    "APM.Extension.Version": oboe.Config.getVersionString(),
  }
}

export function sendStatus(
  reporter: oboe.Reporter,
  data: Record<string, string | number | boolean>,
): number {
  const md = oboe.Metadata.makeRandom(true)
  oboe.Context.set(md)

  const evt = md.createEvent()
  for (const [k, v] of Object.entries(data)) {
    evt.addInfo(k, v)
  }

  return reporter.sendStatus(evt)
}

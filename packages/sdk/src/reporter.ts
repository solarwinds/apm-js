import * as process from "node:process"

import { type AttributeValue } from "@opentelemetry/api"
import { type Resource } from "@opentelemetry/resources"
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions"
import { oboe } from "@swotel/bindings"
import { dependencies } from "@swotel/dependencies"
import * as semver from "semver"

import { type SwoConfiguration } from "./config"

export function createReporter(config: SwoConfiguration): oboe.Reporter {
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

export function initMessage(
  resource: Resource,
): Record<string, string | number | boolean> {
  // eslint-disable-next-line ts/no-var-requires
  const packageJson = require("../package.json") as { version: string }

  const libsVersions = Object.fromEntries(
    Object.entries(process.versions)
      .filter(([name]) => name !== "node")
      .map(([name, version]) => [`Node.${name}.Version`, version!]),
  )
  const depsVersions = Object.fromEntries(
    [...dependencies()].map(([name, versions]) => [
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

    "APM.Version": packageJson.version,
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

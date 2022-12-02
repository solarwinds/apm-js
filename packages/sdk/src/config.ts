import { type NodeSDKConfiguration } from "@opentelemetry/sdk-node"
import * as oboe from "@swotel/bindings"

import { OboeError } from "./error"

const MAX_TIMEOUT = 10_000

type SwoOverrides = "textMapPropagator" | "sampler" | "spanExporter"
export interface SwoConfiguration
  extends Omit<Partial<NodeSDKConfiguration>, SwoOverrides> {
  serviceKey: string
  collector?: string
  certificate?: string

  triggerTraceEnabled?: boolean
}

export function init(config: SwoConfiguration): oboe.Reporter {
  const reporter = new oboe.Reporter({
    service_key: config.serviceKey,
    host: config.collector ?? "",
    certificates: config.certificate ?? "",

    hostname_alias: "",
    log_level: -2,
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
    metric_format: 0,
  })
  if (reporter.init_status !== oboe.INIT_OK) {
    throw new OboeError("Reporter", reporter.init_status)
  }

  let timeout = 100
  for (;;) {
    const status = oboe.Context.isReady(timeout)

    switch (status) {
      case oboe.SERVER_RESPONSE_OK: {
        return reporter
      }
      case oboe.SERVER_RESPONSE_TRY_LATER: {
        if (timeout >= MAX_TIMEOUT) {
          console.warn(
            "exceeded maximum timeout for collector readiness, the application will start but may not collect traces immediately",
          )
          return reporter
        }

        timeout *= 2
        continue
      }
      default: {
        throw new OboeError("Context", "isReady", status)
      }
    }
  }
}

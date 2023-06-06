import { oboe } from "@swotel/bindings"
import { type SwoConfiguration } from "@swotel/sdk"

export function createReporter(config: SwoConfiguration): oboe.Reporter {
  return new oboe.Reporter({
    service_key: config.serviceKey,
    host: config.collector ?? "",
    certificates: config.certificate ?? "",

    hostname_alias: "",
    log_level: 6, // TODO: redirect to otel diag api
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

import * as fs from "node:fs/promises"

import { oboe } from ".."

const INIT_TIMEOUT = 10_000

describe("Reporter", () => {
  beforeAll(async () => {
    if (process.env.TEST_TRUSTEDPATH) {
      const certificates = await fs.readFile(process.env.TEST_TRUSTEDPATH, {
        encoding: "utf8",
      })
      process.env.TEST_CERTIFICATES = certificates
    }
  })

  it(
    "should initialise with service key and collector",
    () => {
      const reporter = new oboe.Reporter({
        service_key: process.env.TEST_SERVICE_KEY!,
        host: process.env.TEST_COLLECTOR ?? "",
        certificates: process.env.TEST_CERTIFICATES ?? "",

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
      expect(reporter.init_status).toBe(oboe.INIT_OK)

      const ready = oboe.Context.isReady(INIT_TIMEOUT)
      expect(ready).toBe(oboe.SERVER_RESPONSE_OK)
    },
    INIT_TIMEOUT,
  )
})
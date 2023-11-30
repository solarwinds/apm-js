/*
Copyright 2023 SolarWinds Worldwide, LLC.

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

import { describe, expect, it } from "@solarwinds-apm/test"

import { oboe } from ".."

const INIT_TIMEOUT = 10_000

describe("Reporter", () => {
  it("should initialise with service key and collector", () => {
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

      log_type: oboe.INIT_LOG_TYPE_NULL,
    })
    expect(reporter.init_status).to.equal(oboe.INIT_OK)

    const ready = oboe.Context.isReady(INIT_TIMEOUT)
    expect(ready).to.equal(oboe.SERVER_RESPONSE_OK)
  })
})

describe("Metadata", () => {
  describe("makeRandom", () => {
    it("should produce valid metadata", () => {
      const random = oboe.Metadata.makeRandom()
      expect(random.isValid()).to.be.true
    })
  })
})

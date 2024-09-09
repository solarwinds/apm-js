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

import { createTraceState, TraceFlags } from "@opentelemetry/api"
import { SamplingDecision } from "@opentelemetry/sdk-trace-base"
import { oboe } from "@solarwinds-apm/bindings"
import { SpanType, TracingMode } from "@solarwinds-apm/sampling"
import { describe, expect, it } from "@solarwinds-apm/test"

import {
  fromOboeDecisionsResult,
  intoOboeDecisionOptions,
} from "../../src/appoptics/sampler.js"

const lit = process.platform === "linux" ? it : it.skip.bind(it)

describe("intoOboeDecisionOptions", () => {
  lit("creates proper options for root spans", () => {
    const options = intoOboeDecisionOptions(
      undefined,
      SpanType.ROOT,
      { triggerMode: false },
      {},
      undefined,
    )

    expect(options).to.loosely.deep.equal({
      in_xtrace: null,
      custom_trigger_mode: oboe.TRIGGER_DISABLED,
      request_type: oboe.REQUEST_TYPE_REGULAR,
    } satisfies oboe.DecisionOptions)
  })

  lit("creates proper options for entry spans", () => {
    const options = intoOboeDecisionOptions(
      {
        traceId: "0123456789abcdef0123456789abcdef",
        spanId: "0123456789abcdef",
        traceFlags: TraceFlags.SAMPLED,
        traceState: createTraceState().set("sw", "0123456789abcdef-01"),
      },
      SpanType.ENTRY,
      { triggerMode: false },
      {},
      undefined,
    )

    expect(options).to.loosely.deep.equal({
      in_xtrace: "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01",
      tracestate: "0123456789abcdef-01",
      custom_trigger_mode: oboe.TRIGGER_DISABLED,
      request_type: oboe.REQUEST_TYPE_REGULAR,
    } satisfies oboe.DecisionOptions)
  })

  lit("creates proper options for trigger traced spans", () => {
    const options = intoOboeDecisionOptions(
      undefined,
      SpanType.ROOT,
      { triggerMode: true },
      {
        "X-Trace-Options": "trigger-trace;ts=12345678",
        "X-Trace-Options-Signature": "signature",
      },
      { triggerTrace: true, timestamp: 12345678, custom: {}, ignored: [] },
    )

    expect(options).to.loosely.deep.equal({
      in_xtrace: null,
      custom_trigger_mode: oboe.TRIGGER_ENABLED,
      request_type: oboe.REQUEST_TYPE_TRIGGER,
      header_options: "trigger-trace;ts=12345678",
      header_signature: "signature",
      header_timestamp: 12345678,
    } satisfies oboe.DecisionOptions)
  })

  lit("creates proper options for custom transaction settings spans", () => {
    const options = intoOboeDecisionOptions(
      undefined,
      SpanType.ROOT,
      { triggerMode: false, tracingMode: TracingMode.NEVER },
      {},
      undefined,
    )

    expect(options).to.loosely.deep.equal({
      in_xtrace: null,
      custom_tracing_mode: oboe.TRACE_DISABLED,
      custom_trigger_mode: oboe.TRIGGER_DISABLED,
      request_type: oboe.REQUEST_TYPE_REGULAR,
    } satisfies oboe.DecisionOptions)
  })
})

describe("fromOboeDecisionsResult", () => {
  lit("creates proper result for sampled span", () => {
    const result = fromOboeDecisionsResult(
      {
        do_sample: 1,
        do_metrics: 1,
        sample_rate: 50_000,
        bucket_cap: 10,
        bucket_rate: 100,
        type: oboe.SETTINGS_TYPE_LAYER_SAMPLE_RATE,
        sample_source: oboe.SAMPLE_RATE_SOURCE_OBOE_DEFAULT,
        status: oboe.TRACING_DECISIONS_OK,
        status_msg: "ok",
        auth: oboe.TRACING_DECISIONS_AUTH_NOT_PRESENT,
        auth_msg: "",
      },
      undefined,
    )

    expect(result).to.loosely.deep.equal({
      samplingResult: {
        decision: SamplingDecision.RECORD_AND_SAMPLED,
        attributes: {
          SampleRate: 50_000,
          SampleSource: 6,
          BucketCapacity: 10,
          BucketRate: 100,
        },
      },
      traceOptionsResponse: {},
    })
  })

  lit("creates proper result for trigger-traced span", () => {
    const result = fromOboeDecisionsResult(
      {
        do_sample: 1,
        do_metrics: 1,
        sample_rate: 100_000,
        bucket_cap: 100,
        bucket_rate: 500,
        type: oboe.SETTINGS_TYPE_LAYER_SAMPLE_RATE,
        sample_source: oboe.SAMPLE_RATE_SOURCE_OBOE_DEFAULT,
        status: oboe.TRACING_DECISIONS_OK,
        status_msg: "ok",
        auth: oboe.TRACING_DECISIONS_AUTH_OK,
        auth_msg: "ok",
      },
      {
        triggerTrace: true,
        timestamp: 12345678,
        custom: { "custom-foo": "custom-bar" },
        ignored: [["foo", "bar"]],
        swKeys: "sw",
      },
    )

    expect(result).to.loosely.deep.equal({
      samplingResult: {
        decision: SamplingDecision.RECORD_AND_SAMPLED,
        attributes: {
          TriggeredTrace: true,
          BucketCapacity: 100,
          BucketRate: 500,
          "custom-foo": "custom-bar",
          SWKeys: "sw",
        },
      },
      traceOptionsResponse: {
        triggerTrace: "ok",
        auth: "ok",
        ignored: ["foo"],
      },
    })
  })

  lit("creates proper result for recorded span", () => {
    const result = fromOboeDecisionsResult(
      {
        do_sample: 0,
        do_metrics: 1,
        sample_rate: 50_000,
        bucket_cap: 10,
        bucket_rate: 100,
        type: oboe.SETTINGS_TYPE_LAYER_SAMPLE_RATE,
        sample_source: oboe.SAMPLE_RATE_SOURCE_OBOE_DEFAULT,
        status: oboe.TRACING_DECISIONS_OK,
        status_msg: "ok",
        auth: oboe.TRACING_DECISIONS_AUTH_NOT_PRESENT,
        auth_msg: "",
      },
      undefined,
    )

    expect(result).to.loosely.deep.equal({
      samplingResult: {
        decision: SamplingDecision.RECORD,
        attributes: {},
      },
      traceOptionsResponse: {},
    })
  })

  lit("creates proper result for non-recorded span", () => {
    const result = fromOboeDecisionsResult(
      {
        do_sample: 0,
        do_metrics: 0,
        sample_rate: 50_000,
        bucket_cap: 10,
        bucket_rate: 100,
        type: oboe.SETTINGS_TYPE_LAYER_SAMPLE_RATE,
        sample_source: oboe.SAMPLE_RATE_SOURCE_OBOE,
        status: oboe.TRACING_DECISIONS_FAILED_AUTH,
        status_msg: "auth-failed",
        auth: oboe.TRACING_DECISIONS_AUTH_NOT_PRESENT,
        auth_msg: "bad-signature",
      },
      { custom: {}, ignored: [] },
    )

    expect(result).to.loosely.deep.include({
      samplingResult: {
        decision: SamplingDecision.NOT_RECORD,
        attributes: {},
      },
      traceOptionsResponse: {
        triggerTrace: undefined,
        auth: "bad-signature",
        ignored: [],
      },
    })
  })
})

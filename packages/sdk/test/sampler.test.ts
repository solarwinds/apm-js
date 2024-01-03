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

import { SpanKind } from "@opentelemetry/api"
import { SamplingDecision } from "@opentelemetry/sdk-trace-base"
import { SemanticAttributes } from "@opentelemetry/semantic-conventions"
import { oboe } from "@solarwinds-apm/bindings"
import { describe, expect, it } from "@solarwinds-apm/test"

import { swValue } from "../src/context"
import { SwSampler } from "../src/sampler"
import * as mock from "./mock"

describe("SwSampler", () => {
  const tracingMode = "tracingMode" as const
  describe(tracingMode, () => {
    it("is unset when no config or transaction settings", () => {
      const sampler = new SwSampler(
        mock.config({ tracingMode: undefined, transactionSettings: undefined }),
        mock.logger(),
        undefined,
      )

      const result = sampler[tracingMode]("name", SpanKind.SERVER, {})
      expect(result).to.equal(oboe.SETTINGS_UNSET)
    })

    it("is enabled when config is true and no transaction settings", () => {
      const sampler = new SwSampler(
        mock.config({ tracingMode: true, transactionSettings: undefined }),
        mock.logger(),
        undefined,
      )

      const result = sampler[tracingMode]("name", SpanKind.SERVER, {})
      expect(result).to.equal(oboe.TRACE_ENABLED)
    })

    it("is disabled when config is false and no transaction settings", () => {
      const sampler = new SwSampler(
        mock.config({ tracingMode: false, transactionSettings: undefined }),
        mock.logger(),
        undefined,
      )

      const result = sampler[tracingMode]("name", SpanKind.SERVER, {})
      expect(result).to.equal(oboe.TRACE_DISABLED)
    })

    it("is unset when no config no transaction setting matches", () => {
      const settings = [{ tracing: false, matcher: () => false }]
      const sampler = new SwSampler(
        mock.config({ tracingMode: undefined, transactionSettings: settings }),
        mock.logger(),
        undefined,
      )

      const result = sampler[tracingMode]("name", SpanKind.SERVER, {})
      expect(result).to.equal(oboe.SETTINGS_UNSET)
    })

    it("is enabled when config is true and no transaction setting matches", () => {
      const settings = [{ tracing: true, matcher: () => false }]
      const sampler = new SwSampler(
        mock.config({ tracingMode: true, transactionSettings: settings }),
        mock.logger(),
        undefined,
      )

      const result = sampler[tracingMode]("name", SpanKind.SERVER, {})
      expect(result).to.equal(oboe.TRACE_ENABLED)
    })

    it("is disabled when config is false and no transaction setting matches", () => {
      const settings = [{ tracing: false, matcher: () => true }]
      const sampler = new SwSampler(
        mock.config({ tracingMode: false, transactionSettings: settings }),
        mock.logger(),
        undefined,
      )

      const result = sampler[tracingMode]("name", SpanKind.SERVER, {})
      expect(result).to.equal(oboe.TRACE_DISABLED)
    })

    it("is enabled if config is disabled but matching transaction setting is enabled", () => {
      const settings = [{ tracing: true, matcher: () => true }]
      const sampler = new SwSampler(
        mock.config({ tracingMode: false, transactionSettings: settings }),
        mock.logger(),
        undefined,
      )

      const result = sampler[tracingMode]("name", SpanKind.SERVER, {})
      expect(result).to.equal(oboe.TRACE_ENABLED)
    })

    it("is disabled if config is enabled but matching transaction setting is disabled", () => {
      const settings = [{ tracing: false, matcher: () => true }]
      const sampler = new SwSampler(
        mock.config({ tracingMode: true, transactionSettings: settings }),
        mock.logger(),
        undefined,
      )

      const result = sampler[tracingMode]("name", SpanKind.SERVER, {})
      expect(result).to.equal(oboe.TRACE_DISABLED)
    })

    it("respects the first matching transaction setting for http spans", () => {
      const target = "/auth"
      const settings = [
        { tracing: false, matcher: (url: string) => url.endsWith(target) },
        { tracing: true, matcher: () => true },
      ]
      const attributes = {
        [SemanticAttributes.HTTP_SCHEME]: "http",
        [SemanticAttributes.NET_HOST_NAME]: "localhost",
        [SemanticAttributes.HTTP_TARGET]: target,
      }

      const sampler = new SwSampler(
        mock.config({ transactionSettings: settings }),
        mock.logger(),
        undefined,
      )

      const result = sampler[tracingMode]("name", SpanKind.SERVER, attributes)
      expect(result).to.equal(oboe.TRACE_DISABLED)
    })

    it("respects the first matching transaction setting for non-http spans", () => {
      const name = "name"
      const kind = SpanKind.SERVER
      const settings = [
        {
          tracing: true,
          matcher: (id: string) => id === `${SpanKind[kind]}:${name}`,
        },
        { tracing: false, matcher: () => true },
      ]
      const sampler = new SwSampler(
        mock.config({ transactionSettings: settings }),
        mock.logger(),
        undefined,
      )

      const result = sampler[tracingMode](name, kind, {})
      expect(result).to.equal(oboe.TRACE_ENABLED)
    })
  })

  const otelSamplingDecisionFromOboe = "otelSamplingDecisionFromOboe" as const
  describe(otelSamplingDecisionFromOboe, () => {
    it("records and samples if do_sample and do_metrics are set", () => {
      const decision = SwSampler[otelSamplingDecisionFromOboe](
        mock.oboeDecisions({ do_sample: 1, do_metrics: 1 }),
      )
      expect(decision).to.equal(SamplingDecision.RECORD_AND_SAMPLED)
    })

    it("records and samples if do_sample is set and do_metrics is not set", () => {
      const decision = SwSampler[otelSamplingDecisionFromOboe](
        mock.oboeDecisions({
          do_sample: 1,
          do_metrics: 0,
        }),
      )
      expect(decision).to.equal(SamplingDecision.RECORD_AND_SAMPLED)
    })

    it("only records if do_sample is not set and do_metrics is set", () => {
      const decision = SwSampler[otelSamplingDecisionFromOboe](
        mock.oboeDecisions({
          do_sample: 0,
          do_metrics: 1,
        }),
      )
      expect(decision).to.equal(SamplingDecision.RECORD)
    })

    it("doesn't record or sample if do_sample and do_metrics are not set", () => {
      const decision = SwSampler[otelSamplingDecisionFromOboe](
        mock.oboeDecisions({
          do_sample: 0,
          do_metrics: 0,
        }),
      )
      expect(decision).to.equal(SamplingDecision.NOT_RECORD)
    })
  })

  const traceState = "traceState" as const
  describe(traceState, () => {
    it("preserves parent trace state", () => {
      const decisions = mock.oboeDecisions()
      const parentTraceState = mock.traceState("key=value")
      const parentContext = mock.spanContext({ traceState: parentTraceState })

      const result = SwSampler[traceState](decisions, parentContext, undefined)

      expect(result.get("key")).to.equal("value")
    })
  })

  const updateTraceState = "updateTraceState" as const
  describe(updateTraceState, () => {
    it("sets trace options response when present", () => {
      const old = mock.traceState()
      const decisions = mock.oboeDecisions()
      const traceOptions = mock.traceOptions()

      const updated = SwSampler[updateTraceState](
        old,
        decisions,
        undefined,
        traceOptions,
      )

      expect(updated.get("xtrace_options_response")).to.deep.equal(
        SwSampler[traceOptionsResponse](decisions, undefined, traceOptions),
      )
    })
  })

  const traceOptionsResponse = "traceOptionsResponse" as const
  describe(traceOptionsResponse, () => {
    it("contains auth message when present with signature", () => {
      const authMsg = "this is a message"
      const decisions = mock.oboeDecisions({
        auth_msg: authMsg,
      })
      const traceOptions = mock.traceOptions({
        signature: "signature",
      })

      const response = SwSampler[traceOptionsResponse](
        decisions,
        undefined,
        traceOptions,
      )

      expect(response).to.include(`auth####${authMsg}`)
    })

    it("contains ignored value when trigger-trace ignored", () => {
      const decisions = mock.oboeDecisions({
        auth: 0,
        type: 0,
      })
      const parentContext = mock.spanContext({
        isRemote: true,
      })
      const traceOptions = mock.traceOptions({
        triggerTrace: true,
      })

      const response = SwSampler[traceOptionsResponse](
        decisions,
        parentContext,
        traceOptions,
      )

      expect(response).to.include("trigger-trace####ignored")
    })

    it("contains status message when trigger-trace not ignored", () => {
      const statusMsg = "this is a message"
      const decisions = mock.oboeDecisions({
        auth: 0,
        status_msg: statusMsg,
      })
      const traceOptions = mock.traceOptions({
        triggerTrace: true,
      })

      const response = SwSampler[traceOptionsResponse](
        decisions,
        undefined,
        traceOptions,
      )

      expect(response).to.include(`trigger-trace####${statusMsg}`)
    })

    it("contains not requested message when trigger-trace no requested", () => {
      const decisions = mock.oboeDecisions({
        auth: 0,
      })
      const traceOptions = mock.traceOptions({
        triggerTrace: false,
      })

      const response = SwSampler[traceOptionsResponse](
        decisions,
        undefined,
        traceOptions,
      )

      expect(response).to.include("trigger-trace####not-requested")
    })

    it("contains ignored trace options", () => {
      const k1 = "key 1"
      const k2 = "key 2"
      const decisions = mock.oboeDecisions()
      const traceOptions = mock.traceOptions({
        ignored: [
          [k1, undefined],
          [k2, "value"],
        ],
      })

      const response = SwSampler[traceOptionsResponse](
        decisions,
        undefined,
        traceOptions,
      )

      expect(response).to.include(`ignored####${k1}....${k2}`)
    })
  })

  const attributes = "attributes" as const
  describe(attributes, () => {
    it("preserves existing attributes immutably", () => {
      const old = { foo: "bar" }
      const decisions = mock.oboeDecisions({ do_sample: 1 })

      const attrs = SwSampler[attributes](
        old,
        decisions,
        undefined,
        undefined,
        mock.traceState(),
      )

      expect(attrs).to.include(old)
      expect(attrs).to.be.frozen
    })

    it("propagates sw keys and custom keys", () => {
      const decisions = mock.oboeDecisions({ do_sample: 1 })
      const swKeys = "foo=bar"
      const custom = { foo: "bar" }
      const traceOptions = mock.traceOptions({ swKeys, custom })

      const attrs = SwSampler[attributes](
        {},
        decisions,
        undefined,
        traceOptions,
        mock.traceState(),
      )

      expect(attrs).to.deep.include({
        SWKeys: swKeys,
        ...custom,
      })
    })

    it("propagates attributes from decisions", () => {
      const bucketCap = 1
      const bucketRate = 2
      const sampleRate = 3
      const sampleSource = 4
      const decisions = mock.oboeDecisions({
        do_sample: 1,
        bucket_cap: bucketCap,
        bucket_rate: bucketRate,
        sample_rate: sampleRate,
        sample_source: sampleSource,
      })

      const attrs = SwSampler[attributes](
        {},
        decisions,
        undefined,
        undefined,
        mock.traceState(),
      )

      expect(attrs).to.include({
        BucketCapacity: bucketCap,
        BucketRate: bucketRate,
        SampleRate: sampleRate,
        SampleSource: sampleSource,
      })
    })

    it("propagates parent id when remote", () => {
      const parentId = mock.spanId()
      const parentContext = mock.spanContext({
        spanId: parentId,
        isRemote: true,
      })
      const parentSw = swValue(parentContext)
      const traceState = mock.traceState(`sw=${parentSw}`)
      parentContext.traceState = traceState

      const decisions = mock.oboeDecisions({ do_sample: 1 })

      const attrs = SwSampler[attributes](
        {},
        decisions,
        parentContext,
        undefined,
        traceState,
      )

      expect(attrs).to.include({
        "sw.tracestate_parent_id": parentId,
      })
    })
  })
})

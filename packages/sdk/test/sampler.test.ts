import { SpanKind } from "@opentelemetry/api"
import { SamplingDecision } from "@opentelemetry/sdk-trace-base"
import { SemanticAttributes } from "@opentelemetry/semantic-conventions"
import { oboe } from "@swotel/bindings"

import { swValue } from "../src/context"
import { SwoSampler } from "../src/sampler"
import * as mock from "./mock"

describe("SwoSampler", () => {
  const tracingMode = "tracingMode" as const
  describe(tracingMode, () => {
    it("is unset when no transaction settings", () => {
      const sampler = new SwoSampler({ serviceKey: "" }, mock.logger())

      const result = sampler[tracingMode]("name", SpanKind.SERVER, {})
      expect(result).toBe(oboe.SETTINGS_UNSET)
    })

    it("is unset when no transaction setting matches", () => {
      const settings = [{ tracing: false, matcher: () => false }]
      const sampler = new SwoSampler(
        { serviceKey: "", transactionSettings: settings },
        mock.logger(),
      )

      const result = sampler[tracingMode]("name", SpanKind.SERVER, {})
      expect(result).toBe(oboe.SETTINGS_UNSET)
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

      const sampler = new SwoSampler(
        { serviceKey: "", transactionSettings: settings },
        mock.logger(),
      )

      const result = sampler[tracingMode]("name", SpanKind.SERVER, attributes)
      expect(result).toBe(oboe.TRACE_DISABLED)
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
      const sampler = new SwoSampler(
        { serviceKey: "", transactionSettings: settings },
        mock.logger(),
      )

      const result = sampler[tracingMode](name, kind, {})
      expect(result).toBe(oboe.TRACE_ENABLED)
    })
  })

  const otelSamplingDecisionFromOboe = "otelSamplingDecisionFromOboe" as const
  describe(otelSamplingDecisionFromOboe, () => {
    it("records and samples if do_sample and do_metrics are set", () => {
      const decision = SwoSampler[otelSamplingDecisionFromOboe](
        mock.oboeDecisions({ do_sample: 1, do_metrics: 1 }),
      )
      expect(decision).toEqual(SamplingDecision.RECORD_AND_SAMPLED)
    })

    it("records and samples if do_sample is set and do_metrics is not set", () => {
      const decision = SwoSampler[otelSamplingDecisionFromOboe](
        mock.oboeDecisions({
          do_sample: 1,
          do_metrics: 0,
        }),
      )
      expect(decision).toEqual(SamplingDecision.RECORD_AND_SAMPLED)
    })

    it("only records if do_sample is not set and do_metrics is set", () => {
      const decision = SwoSampler[otelSamplingDecisionFromOboe](
        mock.oboeDecisions({
          do_sample: 0,
          do_metrics: 1,
        }),
      )
      expect(decision).toEqual(SamplingDecision.RECORD)
    })

    it("doesn't record or sample if do_sample and do_metrics are not set", () => {
      const decision = SwoSampler[otelSamplingDecisionFromOboe](
        mock.oboeDecisions({
          do_sample: 0,
          do_metrics: 0,
        }),
      )
      expect(decision).toEqual(SamplingDecision.NOT_RECORD)
    })
  })

  const traceState = "traceState" as const
  describe(traceState, () => {
    it("preserves parent trace state", () => {
      const decisions = mock.oboeDecisions()
      const parentTraceState = mock.traceState("key=value")
      const parentContext = mock.spanContext({ traceState: parentTraceState })

      const result = SwoSampler[traceState](decisions, parentContext, undefined)

      expect(result.get("key")).toBe("value")
    })
  })

  const updateTraceState = "updateTraceState" as const
  describe(updateTraceState, () => {
    it("sets sw value", () => {
      const old = mock.traceState()
      const decisions = mock.oboeDecisions()

      const updated = SwoSampler[updateTraceState](
        old,
        decisions,
        undefined,
        undefined,
      )

      expect(updated.get("sw")).toEqual(swValue(undefined, decisions))
    })

    it("sets trace options response when present", () => {
      const old = mock.traceState()
      const decisions = mock.oboeDecisions()
      const traceOptions = mock.traceOptions()

      const updated = SwoSampler[updateTraceState](
        old,
        decisions,
        undefined,
        traceOptions,
      )

      expect(updated.get("xtrace_options_response")).toEqual(
        SwoSampler[traceOptionsResponse](decisions, undefined, traceOptions),
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

      const response = SwoSampler[traceOptionsResponse](
        decisions,
        undefined,
        traceOptions,
      )

      expect(response).toInclude(`auth####${authMsg}`)
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

      const response = SwoSampler[traceOptionsResponse](
        decisions,
        parentContext,
        traceOptions,
      )

      expect(response).toInclude("trigger-trace####ignored")
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

      const response = SwoSampler[traceOptionsResponse](
        decisions,
        undefined,
        traceOptions,
      )

      expect(response).toInclude(`trigger-trace####${statusMsg}`)
    })

    it("contains not requested message when trigger-trace no requested", () => {
      const decisions = mock.oboeDecisions({
        auth: 0,
      })
      const traceOptions = mock.traceOptions({
        triggerTrace: false,
      })

      const response = SwoSampler[traceOptionsResponse](
        decisions,
        undefined,
        traceOptions,
      )

      expect(response).toInclude("trigger-trace####not-requested")
    })

    it("contains ignored trace options", () => {
      const k1 = "key 1"
      const k2 = "key 2"
      const decisions = mock.oboeDecisions()
      const traceOptions = mock.traceOptions({
        ignored: [[k1], [k2, "value"]],
      })

      const response = SwoSampler[traceOptionsResponse](
        decisions,
        undefined,
        traceOptions,
      )

      expect(response).toInclude(`ignored####${k1}....${k2}`)
    })
  })

  const attributes = "attributes" as const
  describe(attributes, () => {
    it("preserves existing attributes immutably", () => {
      const old = { foo: "bar" }
      const decisions = mock.oboeDecisions({ do_sample: 1 })

      const attrs = SwoSampler[attributes](
        old,
        decisions,
        undefined,
        undefined,
        mock.traceState(),
      )

      expect(attrs).toMatchObject(old)
      expect(attrs).toBeFrozen()
    })

    it("propagates sw keys and custom keys", () => {
      const decisions = mock.oboeDecisions({ do_sample: 1 })
      const swKeys = "foo=bar"
      const custom = { foo: "bar" }
      const traceOptions = mock.traceOptions({ swKeys, custom })

      const attrs = SwoSampler[attributes](
        {},
        decisions,
        undefined,
        traceOptions,
        mock.traceState(),
      )

      expect(attrs).toMatchObject({
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

      const attrs = SwoSampler[attributes](
        {},
        decisions,
        undefined,
        undefined,
        mock.traceState(),
      )

      expect(attrs).toMatchObject({
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

      const attrs = SwoSampler[attributes](
        {},
        decisions,
        parentContext,
        undefined,
        traceState,
      )

      expect(attrs).toMatchObject({
        "sw.tracestate_parent_id": parentId,
      })
    })
  })
})

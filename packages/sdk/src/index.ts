import { metrics, oboe } from "@swotel/bindings"

import { CompoundSpanProcessor } from "./compound-processor"
import { type SwoConfiguration } from "./config"
import { setTransactionName, waitUntilAgentReady } from "./context"
import { SwoExporter } from "./exporter"
import { SwoInboundMetricsSpanProcessor } from "./inbound-metrics-processor"
import { SwoMetricsExporter } from "./metric-exporter"
import { SwoParentInfoSpanProcessor } from "./parent-info-processor"
import { patch } from "./patches"
import { createReporter, initMessage, sendStatus } from "./reporter"
import { SwoSampler } from "./sampler"
import { SwoTraceContextOptionsPropagator } from "./trace-context-options-propagator"
import { SwoTraceOptionsResponsePropagator } from "./trace-options-response-propagator"

export const OBOE_ERROR: Error | false = oboe instanceof Error ? oboe : false
export const METRICS_ERROR: Error | false =
  metrics instanceof Error ? metrics : false

export {
  CompoundSpanProcessor,
  createReporter,
  initMessage,
  patch,
  sendStatus,
  setTransactionName,
  SwoConfiguration,
  SwoExporter,
  SwoInboundMetricsSpanProcessor,
  SwoMetricsExporter,
  SwoParentInfoSpanProcessor,
  SwoSampler,
  SwoTraceContextOptionsPropagator,
  SwoTraceOptionsResponsePropagator,
  waitUntilAgentReady,
}
export * as metrics from "./metrics"

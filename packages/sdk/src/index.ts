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

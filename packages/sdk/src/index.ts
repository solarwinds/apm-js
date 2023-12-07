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

import { metrics, oboe } from "@solarwinds-apm/bindings"

import { CompoundSpanProcessor } from "./compound-processor"
import { type SwConfiguration } from "./config"
import { setTransactionName, waitUntilReady } from "./context"
import { SwDiagLogger } from "./diag-logger"
import { SwExporter } from "./exporter"
import { SwInboundMetricsSpanProcessor } from "./inbound-metrics-processor"
import { SwMetricsExporter } from "./metric-exporter"
import { SwParentInfoSpanProcessor } from "./parent-info-processor"
import { patch } from "./patches"
import {
  createReporter,
  createServerlessApi,
  initMessage,
  sendStatus,
} from "./reporter"
import { SwSampler } from "./sampler"
import { SwTraceContextOptionsPropagator } from "./trace-context-options-propagator"
import { SwTraceOptionsResponsePropagator } from "./trace-options-response-propagator"
import { SwTransactionNameProcessor } from "./transaction-name-processor"

export const OBOE_ERROR: Error | false = oboe instanceof Error ? oboe : false
export const METRICS_ERROR: Error | false =
  metrics instanceof Error ? metrics : false

export {
  CompoundSpanProcessor,
  createReporter,
  createServerlessApi,
  initMessage,
  patch,
  sendStatus,
  setTransactionName,
  SwConfiguration,
  SwDiagLogger,
  SwExporter,
  SwInboundMetricsSpanProcessor,
  SwMetricsExporter,
  SwParentInfoSpanProcessor,
  SwSampler,
  SwTraceContextOptionsPropagator,
  SwTraceOptionsResponsePropagator,
  SwTransactionNameProcessor,
  waitUntilReady,
}
export * as metrics from "./metrics"

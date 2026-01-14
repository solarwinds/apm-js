/*
Copyright 2023-2026 SolarWinds Worldwide, LLC.

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

import { type OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto"
import { type OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto"
import { type OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto"
import { CompressionAlgorithm } from "@opentelemetry/otlp-exporter-base"

import { type Configuration as NodeConfiguration } from "../config.js"
import { environment, IS_NODE } from "../env.js"
import { type Configuration as WebConfiguration } from "../web/config.js"
import { agentFactory } from "./proxy.js"

export type Configuration = NodeConfiguration | WebConfiguration
type Options<Exporter extends new (options: never) => unknown> =
  Exporter extends new (options: infer Options) => unknown ? Options : never

export function exporterConfig(
  config: Configuration,
  signal: "traces" | "metrics" | "logs",
): Options<
  typeof OTLPTraceExporter | typeof OTLPMetricExporter | typeof OTLPLogExporter
> {
  const url = config.otlp[signal]
  const headers = { ...config.headers }

  try {
    if (
      config.token &&
      (new URL(url).hostname.endsWith(".solarwinds.com") || environment.DEV)
    ) {
      headers.authorization = `Bearer ${config.token}`
    }
  } catch {
    // invalid user provided endpoint url
  }

  return {
    url,
    headers,
    compression: CompressionAlgorithm.GZIP,
    httpAgentOptions: IS_NODE
      ? agentFactory(config as NodeConfiguration)
      : undefined,
  }
}

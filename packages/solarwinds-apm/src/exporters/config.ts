/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { type OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto"
import { type OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto"
import { type OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto"
import { CompressionAlgorithm } from "@opentelemetry/otlp-exporter-base"

import { type Configuration as NodeConfiguration } from "../config.ts"
import { environment, IS_NODE } from "../env.ts"
import { type Configuration as WebConfiguration } from "../web/config.ts"
import { agentFactory } from "./proxy.ts"

export type Configuration = NodeConfiguration | WebConfiguration
type Options<Exporter extends new (options: never) => unknown> = Exporter extends new (
	options: infer Options,
) => unknown
	? Options
	: never

export function exporterConfig(
	config: Configuration,
	signal: "traces" | "metrics" | "logs",
): Options<typeof OTLPTraceExporter | typeof OTLPMetricExporter | typeof OTLPLogExporter> {
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
		httpAgentOptions: IS_NODE ? agentFactory(config as NodeConfiguration) : undefined,
	}
}

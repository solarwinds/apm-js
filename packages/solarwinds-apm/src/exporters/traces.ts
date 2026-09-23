/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto"

import { type Configuration, exporterConfig } from "./config.ts"

export class TraceExporter extends OTLPTraceExporter {
	constructor(config: Configuration) {
		super(exporterConfig(config, "traces"))
	}
}

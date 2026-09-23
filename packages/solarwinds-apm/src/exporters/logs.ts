/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto"

import { type Configuration, exporterConfig } from "./config.ts"

export class LogExporter extends OTLPLogExporter {
	constructor(config: Configuration) {
		super(exporterConfig(config, "logs"))
	}
}

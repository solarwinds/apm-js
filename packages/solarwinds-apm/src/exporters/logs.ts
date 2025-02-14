/*
Copyright 2023-2025 SolarWinds Worldwide, LLC.

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

import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http"

import { type Configuration } from "../shared/config.js"

export class LogExporter extends OTLPLogExporter {
  constructor(config: Configuration & { trustedpath?: string }) {
    super({
      url: config.otlp.logs,
      headers: config.headers,
      httpAgentOptions: {
        ca: config.trustedpath,
      },
    })
  }
}

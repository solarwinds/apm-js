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

import { type LoggerProvider } from "@opentelemetry/sdk-logs"
import { type MeterProvider } from "@opentelemetry/sdk-metrics"
import { type BasicTracerProvider } from "@opentelemetry/sdk-trace-base"

import { type Sampler } from "../sampling/sampler.js"
import { cellStorage } from "../storage.js"

/** Global reference to the current sampler */
export const SAMPLER = cellStorage<Sampler | undefined>("sampler")

/** Global reference to the current tracer provider */
export const TRACER_PROVIDER = cellStorage<BasicTracerProvider | undefined>(
  "tracer provider",
)

/** Global reference to the current meter provider */
export const METER_PROVIDER = cellStorage<MeterProvider | undefined>(
  "meter provider",
)

/** Global reference to the current logger provider */
export const LOGGER_PROVIDER = cellStorage<LoggerProvider | undefined>(
  "logger provider",
)

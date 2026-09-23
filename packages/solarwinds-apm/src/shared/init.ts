/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { type LoggerProvider } from "@opentelemetry/sdk-logs"
import { type MeterProvider } from "@opentelemetry/sdk-metrics"
import { type TracerProvider } from "@opentelemetry/sdk-trace"

import { type Sampler } from "../sampling/sampler.ts"
import { cellStorage } from "../storage.ts"

/** Global reference to the current sampler. */
export const SAMPLER = cellStorage<Sampler | undefined>("sampler")

/** Global reference to the current tracer provider. */
export const TRACER_PROVIDER = cellStorage<TracerProvider | undefined>("tracer provider")

/** Global reference to the current meter provider. */
export const METER_PROVIDER = cellStorage<MeterProvider | undefined>("meter provider")

/** Global reference to the current logger provider. */
export const LOGGER_PROVIDER = cellStorage<LoggerProvider | undefined>("logger provider")

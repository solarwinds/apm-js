/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { browserDetector } from "@opentelemetry/opentelemetry-browser-detector"
import { type ResourceDetector } from "@opentelemetry/resources"

import { sessionIdDetector } from "./resource-detector-session-id.ts"

export {
	getWebAutoInstrumentations as getInstrumentations,
	type InstrumentationConfigMap,
} from "@opentelemetry/auto-instrumentations-web"

export function getResourceDetectors(): ResourceDetector[] {
	return [browserDetector, sessionIdDetector]
}

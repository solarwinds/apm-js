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

import { browserDetector } from "@opentelemetry/opentelemetry-browser-detector"
import { type ResourceDetector } from "@opentelemetry/resources"

import { sessionIdDetector } from "./resource-detector-session-id.js"

export {
  getWebAutoInstrumentations as getInstrumentations,
  type InstrumentationConfigMap,
} from "@opentelemetry/auto-instrumentations-web"

export function getResourceDetectors(): ResourceDetector[] {
  return [browserDetector, sessionIdDetector]
}

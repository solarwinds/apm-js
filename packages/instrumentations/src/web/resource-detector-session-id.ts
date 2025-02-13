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

import { type Attributes } from "@opentelemetry/api"
import { type DetectorSync, Resource } from "@opentelemetry/resources"
import {
  ATTR_SERVICE_INSTANCE_ID,
  ATTR_SESSION_ID,
} from "@opentelemetry/semantic-conventions/incubating"

export const sessionIdDetector: DetectorSync = {
  detect: () => {
    const attributes: Attributes = {}
    const id =
      self.sessionStorage.getItem(ATTR_SESSION_ID) ??
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      self.crypto?.randomUUID()

    if (id) {
      self.sessionStorage.setItem(ATTR_SESSION_ID, id)
      attributes[ATTR_SESSION_ID] = id
      attributes[ATTR_SERVICE_INSTANCE_ID] = id
    }
    return new Resource(attributes)
  },
}

/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

/// <reference lib="dom" />

import { type Attributes } from "@opentelemetry/api"
import { type ResourceDetector } from "@opentelemetry/resources"
import {
	ATTR_SERVICE_INSTANCE_ID,
	ATTR_SESSION_ID,
} from "@opentelemetry/semantic-conventions/incubating"

export const sessionIdDetector: ResourceDetector = {
	detect: () => {
		const attributes: Attributes = {}
		const id =
			self.sessionStorage.getItem(ATTR_SESSION_ID) ??
			// oxlint-disable-next-line typescript/no-unnecessary-condition
			self.crypto?.randomUUID()

		if (id) {
			self.sessionStorage.setItem(ATTR_SESSION_ID, id)
			attributes[ATTR_SESSION_ID] = id
			attributes[ATTR_SERVICE_INSTANCE_ID] = id
		}

		return { attributes }
	},
}

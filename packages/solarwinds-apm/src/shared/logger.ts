/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { diag, type DiagLogger } from "@opentelemetry/api"

/** Creates a diag logger for the given named function or class. */
export function componentLogger(component: { readonly name: string }): DiagLogger {
	return diag.createComponentLogger({
		namespace: `solarwinds-apm/${component.name}`,
	})
}

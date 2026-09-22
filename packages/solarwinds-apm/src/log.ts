/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

let log: typeof console.log
if ("SW_APM_LOG_STDERR" in process.env) {
	log = console.error
} else if ("SW_APM_LOG_NULL" in process.env) {
	log = function () {
		// drop the logs
	}
} else {
	log = console.log
}

export default log

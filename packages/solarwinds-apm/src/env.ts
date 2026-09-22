/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

export const IS_NODE =
	typeof globalThis.process === "object" &&
	// oxlint-disable-next-line typescript/no-unnecessary-condition
	typeof globalThis.process?.versions?.node === "string"

export const environment = {
	get AWS_LAMBDA_NAME() {
		return IS_NODE ? process.env.AWS_LAMBDA_FUNCTION_NAME : undefined
	},
	get IS_AWS_LAMBDA() {
		return this.AWS_LAMBDA_NAME !== undefined
	},

	get SERVERLESS_NAME() {
		return this.AWS_LAMBDA_NAME
	},
	get IS_SERVERLESS() {
		return this.IS_AWS_LAMBDA
	},

	get DEV() {
		return IS_NODE ? process.env.SW_APM_DANGEROUS_ENV === "dev" : false
	},
}

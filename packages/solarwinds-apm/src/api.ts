/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { LOGGER_PROVIDER, METER_PROVIDER, SAMPLER, TRACER_PROVIDER } from "./shared/init.ts"

/**
 * Wait until the library is ready to sample traces.
 *
 * @param timeout - Wait timeout in milliseconds.
 * @returns Whether the library is ready
 */
export async function waitUntilReady(timeout: number): Promise<boolean> {
	const sampler = await SAMPLER
	const success = await sampler?.waitUntilReady(timeout)
	return success ?? false
}

/** Forces the library to flush any buffered traces, metrics or logs. */
export async function forceFlush(): Promise<void> {
	const providers = await Promise.all([TRACER_PROVIDER, METER_PROVIDER, LOGGER_PROVIDER])
	await Promise.all(providers.map((provider) => provider?.forceFlush() ?? Promise.resolve()))
}

export { type Config } from "./config.ts"
export { setTransactionName } from "./processing/transaction-name.ts"

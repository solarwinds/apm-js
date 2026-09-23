/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

export interface Settings {
	sampleRate: number
	sampleSource: SampleSource
	flags: number
	buckets: Partial<Record<BucketType, BucketSettings>>
	signatureKey?: Uint8Array
	timestamp: number
	ttl: number
}

export interface LocalSettings {
	tracingMode?: TracingMode
	triggerMode: boolean
}

export const SampleSource = {
	LocalDefault: 2,
	Remote: 6,
} as const
export type SampleSource = (typeof SampleSource)[keyof typeof SampleSource]

export const Flags = {
	OK: 0x0,
	INVALID: 0x1,
	OVERRIDE: 0x2,
	SAMPLE_START: 0x4,
	SAMPLE_THROUGH_ALWAYS: 0x10,
	TRIGGERED_TRACE: 0x20,
} as const
export type Flags = number

export const TracingMode = {
	ALWAYS: Flags.SAMPLE_START | Flags.SAMPLE_THROUGH_ALWAYS,
	NEVER: 0x0,
} as const
export type TracingMode = (typeof TracingMode)[keyof typeof TracingMode]

export const BucketType = {
	DEFAULT: "",
	TRIGGER_RELAXED: "TriggerRelaxed",
	TRIGGER_STRICT: "TriggerStrict",
} as const
export type BucketType = (typeof BucketType)[keyof typeof BucketType]

export interface BucketSettings {
	capacity: number
	rate: number
}

export function merge(remote: Settings, local: LocalSettings): Settings {
	let flags = local.tracingMode ?? remote.flags

	if (local.triggerMode) {
		flags |= Flags.TRIGGERED_TRACE
	} else {
		flags &= ~Flags.TRIGGERED_TRACE
	}

	if (remote.flags & Flags.OVERRIDE) {
		flags &= remote.flags
		// remember OVERRIDE (it could be unset above)
		flags |= Flags.OVERRIDE
	}

	return { ...remote, flags }
}

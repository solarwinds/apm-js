/*
Copyright 2023-2026 SolarWinds Worldwide, LLC.

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

export enum SampleSource {
  LocalDefault = 2,
  Remote = 6,
}

export enum Flags {
  OK = 0x0,
  INVALID = 0x1,
  OVERRIDE = 0x2,
  SAMPLE_START = 0x4,
  SAMPLE_THROUGH_ALWAYS = 0x10,
  TRIGGERED_TRACE = 0x20,
}

export enum TracingMode {
  ALWAYS = Flags.SAMPLE_START | Flags.SAMPLE_THROUGH_ALWAYS,
  NEVER = 0x0,
}

export enum BucketType {
  DEFAULT = "",
  TRIGGER_RELAXED = "TriggerRelaxed",
  TRIGGER_STRICT = "TriggerStrict",
}

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

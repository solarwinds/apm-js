/*
Copyright 2023 SolarWinds Worldwide, LLC.

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

interface OptionalPeerDependencies {
  "@opentelemetry/exporter-metrics-otlp-grpc": typeof import("@opentelemetry/exporter-metrics-otlp-grpc")
  "@opentelemetry/exporter-trace-otlp-grpc": typeof import("@opentelemetry/exporter-trace-otlp-grpc")
  json5: typeof import("json5")
  "ts-node": typeof import("ts-node")
}
type OptionalPeerDependency = keyof OptionalPeerDependencies

export function requireOptional<M extends OptionalPeerDependency, F>(
  module: M,
  fallback: F,
): OptionalPeerDependencies[M] | F
export function requireOptional<M extends OptionalPeerDependency>(
  module: M,
): OptionalPeerDependencies[M] | undefined
export function requireOptional<M extends OptionalPeerDependency, F>(
  module: M,
  fallback?: F,
) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(module) as OptionalPeerDependencies[M]
  } catch {
    return fallback
  }
}

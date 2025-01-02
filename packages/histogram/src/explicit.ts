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

import type * as metrics from "@opentelemetry/sdk-metrics"

import { type Histogram } from "./index.js"

/*
https://github.com/solarwinds-cloud/otel-histograms/blob/main/src/main/kotlin/cloud/solarwinds/otelhistograms/ExplicitHistogram.kt
*/

export class ExplicitHistogram implements Histogram {
  readonly #explicit: metrics.Histogram

  get count() {
    return this.#explicit.count
  }
  get sum() {
    return this.#explicit.sum
  }
  get min() {
    return this.#explicit.min
  }
  get max() {
    return this.#explicit.max
  }

  constructor(explicit: metrics.Histogram) {
    this.#explicit = explicit
  }

  getPercentile(p: number): number {
    if (this.count < 1) {
      return NaN
    }

    const percentile = this.#within(p, 0, 100)
    const distance = (percentile * this.count) / 100
    let traversed = 0

    for (const [i, bucketCount] of this.#explicit.buckets.counts.entries()) {
      if (bucketCount > 0 && distance <= traversed + bucketCount) {
        const bucketDistance = (distance - traversed) / bucketCount
        const lowerBound = this.#explicitBoundAt(i)
        const upperBound = this.#explicitBoundAt(i + 1)
        return this.#within(
          lowerBound + (upperBound - lowerBound) * bucketDistance,
        )
      }
      traversed += bucketCount
    }

    // Should never be reached
    return NaN
  }

  #explicitBoundAt(i: number): number {
    if (i === 0) {
      return this.min ?? this.#within(this.#explicit.buckets.boundaries[0]!)
    } else if (i === this.#explicit.buckets.boundaries.length + 1) {
      return (
        this.max ??
        this.#within(
          this.#explicit.buckets.boundaries[
            this.#explicit.buckets.boundaries.length - 1
          ]!,
        )
      )
    } else {
      return this.#within(this.#explicit.buckets.boundaries[i - 1]!)
    }
  }

  #within(n: number): number
  #within(n: number, min: number, max: number): number
  #within(n: number, ...minmax: [number, number] | []): number {
    if (minmax.length !== 0) {
      const [min, max] = minmax
      return Math.max(min, Math.min(n, max))
    } else {
      if (this.min != undefined) {
        n = Math.max(n, this.min)
      }
      if (this.max != undefined) {
        n = Math.min(n, this.max)
      }
      return n
    }
  }
}

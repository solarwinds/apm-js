/*
Copyright 2023-2024 SolarWinds Worldwide, LLC.

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
https://github.com/solarwinds-cloud/otel-histograms/blob/main/src/main/kotlin/cloud/solarwinds/otelhistograms/ExponentialHistogram.kt
*/

export class ExponentialHistogram implements Histogram {
  readonly #exponential: metrics.ExponentialHistogram

  get count() {
    return this.#exponential.count
  }
  get sum() {
    return this.#exponential.sum
  }
  get min() {
    return this.#exponential.min
  }
  get max() {
    return this.#exponential.max
  }

  constructor(exponential: metrics.ExponentialHistogram) {
    this.#exponential = exponential
  }

  getPercentile(p: number): number {
    if (this.count < 1) {
      return NaN
    }

    const percentile = this.#within(p, 0, 100)
    const base = this.#base
    const distance = (percentile * this.count) / 100
    let traversed = 0

    for (const [i, bucketCount] of [
      ...this.#exponential.negative.bucketCounts.entries(),
    ].reverse()) {
      // Negative buckets have [) bounds
      if (bucketCount > 0 && distance < traversed + bucketCount) {
        const bucketDistance = (distance - traversed) / bucketCount
        return this.#within(
          -(
            base **
            (i + this.#exponential.negative.offset + 1 - bucketDistance)
          ),
        )
      }
      traversed += bucketCount
    }
    // Zero bucket has [] bounds
    if (
      this.#exponential.zeroCount > 0 &&
      distance <= traversed + this.#exponential.zeroCount
    ) {
      // Zero bucket does not follow the exponential scale so we use linear interpolation
      const bucketDistance =
        (distance - traversed) / this.#exponential.zeroCount
      const lowerBound = -(base ** this.#exponential.negative.offset)
      const upperBound = base ** this.#exponential.positive.offset
      return this.#within(
        lowerBound + (upperBound - lowerBound) * bucketDistance,
      )
    }
    traversed += this.#exponential.zeroCount
    for (const [
      i,
      bucketCount,
    ] of this.#exponential.positive.bucketCounts.entries()) {
      // Positive buckets have (] bounds
      if (bucketCount > 0 && distance <= traversed + bucketCount) {
        const bucketDistance = (distance - traversed) / bucketCount
        return this.#within(
          base ** (i + this.#exponential.positive.offset + bucketDistance),
        )
      }
      traversed += bucketCount
    }

    // Should never be reached
    return NaN
  }

  get #base(): number {
    return 2 ** (2 ** -this.#exponential.scale)
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

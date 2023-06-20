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

import {
  type ExponentialHistogram,
  type Histogram,
} from "@opentelemetry/sdk-metrics"

export class OtelHistogram {
  private constructor(
    private readonly data: Histogram,
    private readonly negativeLowerBoundsInclusive: boolean,
  ) {}

  public static fromHistogram(data: Histogram): OtelHistogram {
    return new OtelHistogram({ ...data }, false)
  }

  // https://opentelemetry.io/docs/specs/otel/metrics/data-model/#exponentialhistogram
  // https://opentelemetry.io/blog/2023/exponential-histograms/
  public static fromExponentialHistogram(
    data: ExponentialHistogram,
  ): OtelHistogram {
    const shared = {
      count: data.count,
      sum: data.sum,
      min: data.min,
      max: data.max,
    }

    const base = 2 ** (2 ** -data.scale)
    const calculateLowerBounds = (count: number, offset: number) => {
      const lowerBounds: number[] = []
      for (let i = 0; i < count; i++) {
        lowerBounds.push(base ** (i + offset))
      }
      return lowerBounds
    }

    // Calculate the lower bounds of the positive buckets
    const positiveLowerBounds = calculateLowerBounds(
      data.positive.bucketCounts.length,
      data.positive.offset,
    )
    // Calculate the upper bounds of the negative buckets. We can do this by
    // treating them as lower bounds of positive buckets then reversing the
    // list and negating the values. Technically negative histogram values are
    // not supported by the specification at the time of writing but handling
    // them isn't particularly difficult so might as well
    const negativeUpperBounds = calculateLowerBounds(
      data.negative.bucketCounts.length,
      data.negative.offset,
    )
      .reverse()
      .map((b) => -b)
    // List of all boundaries with open buckets at both ends. The bucket
    // between the negative uppermost bound and the positive lowermost one is
    // the zero bucket.
    const boundaries = [...negativeUpperBounds, ...positiveLowerBounds]

    // List of all bucket counts with the zero bucket in the middle
    const counts = [
      ...data.negative.bucketCounts,
      data.zeroCount,
      ...data.positive.bucketCounts,
    ]

    return new OtelHistogram(
      { ...shared, buckets: { boundaries, counts } },
      true,
    )
  }

  get count(): number {
    return this.data.count
  }

  get sum(): number | undefined {
    return this.data.sum
  }

  get min(): number | undefined {
    return this.data.min
  }
  get max(): number | undefined {
    return this.data.max
  }

  private get bucketCounts(): number[] {
    return this.data.buckets.counts
  }
  private get bucketBoundaries(): number[] {
    return this.data.buckets.boundaries
  }

  mean(): number | undefined {
    if (this.sum === undefined || this.count === 0) {
      return undefined
    }
    return this.sum / this.count
  }

  stddev(): number | undefined {
    if (this.count < 2) {
      return undefined
    }
    const mean = this.mean()!

    let distances = 0
    const boundaries = this.boundedBucketBoundaries()

    for (const [i, bucketCount] of this.bucketCounts.entries()) {
      const bucketMean = (boundaries[i]! + boundaries[i + 1]!) / 2
      distances += bucketCount * (mean - bucketMean) ** 2
    }

    return Math.sqrt(distances / this.count)
  }

  percentile(percentile: number): number | undefined {
    if (this.count === 0) {
      return undefined
    }

    percentile = Math.max(0, Math.min(100, percentile))
    // Index of the value for this percentile across the entire histogram
    const index = Math.floor((percentile / 100) * this.count)

    if (index === 0 && this.min !== undefined) {
      return this.min
    }
    if (index === this.count - 1 && this.max !== undefined) {
      return this.max
    }

    let traversed = 0
    const boundaries = this.boundedBucketBoundaries()

    for (const [i, bucketCount] of this.bucketCounts.entries()) {
      // The value is not in the current bucket
      if (traversed + bucketCount <= index) {
        traversed += bucketCount
        continue
      }

      const indexInBucket = index - traversed
      const lowerBound = boundaries[i]!
      const upperBound = boundaries[i + 1]!

      if (lowerBound < 0 && this.negativeLowerBoundsInclusive) {
        // Lower bound is inclusive and upper bound is exclusive so lerp skewed
        // towards the lower bound.
        return (
          lowerBound + (upperBound - lowerBound) * (indexInBucket / bucketCount)
        )
      } else {
        // Upper bound is inclusive and lower bound is exclusive so lerp skewed
        // towards the upper bound.
        return (
          lowerBound +
          (upperBound - lowerBound) * ((indexInBucket + 1) / bucketCount)
        )
      }
    }
  }

  // Fully bounded boundaries useful for estimations. If the min and max are
  // collected we use them as the lowermost and uppermost boundaries. Otherwise
  // we just reuse the upper bound of the first bucket and lower bound of the
  // last one. This is not ideal but it's better than making up values.
  private boundedBucketBoundaries(): number[] {
    const upperOfFirst = this.bucketBoundaries[0]!
    const lowerOfLast = this.bucketBoundaries[this.bucketBoundaries.length - 1]!

    const lowermostEstimate =
      this.min !== undefined && this.min < upperOfFirst
        ? this.min
        : upperOfFirst
    const uppermostEstimate =
      this.max !== undefined && this.max > lowerOfLast ? this.max : lowerOfLast

    return [lowermostEstimate, ...this.bucketBoundaries, uppermostEstimate]
  }
}

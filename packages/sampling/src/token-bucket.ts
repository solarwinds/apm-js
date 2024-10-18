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

/** Maximum value of a signed 32 bit integer */
const MAX_INTERVAL = 2 ** 31 - 1

/**
 * Token bucket settings
 *
 * The bucket starts with, and is capped at, `capacity` tokens.
 * `rate` tokens are replenished every `interval` milliseconds.
 */
export interface TokenBucketSettings {
  capacity?: number
  rate?: number
  interval?: number
}

export class TokenBucket {
  #c = 0
  get capacity(): number {
    return this.#c
  }
  set #capacity(n: number) {
    this.#c = Math.max(0, n)
  }

  #r = 0
  get rate(): number {
    return this.#r
  }
  set #rate(n: number) {
    this.#r = Math.max(0, n)
  }

  #i = MAX_INTERVAL
  get interval(): number {
    return this.#i
  }
  set #interval(n: number) {
    this.#i = Math.max(0, Math.min(MAX_INTERVAL, n))
  }

  #t = 0
  get #tokens(): number {
    return this.#t
  }
  set #tokens(n: number) {
    this.#t = Math.max(0, Math.min(this.capacity, n))
  }

  #timer: NodeJS.Timeout | undefined = undefined

  constructor(settings: TokenBucketSettings = {}) {
    this.#capacity = settings.capacity ?? 0
    this.#rate = settings.rate ?? 0
    this.#interval = settings.interval ?? MAX_INTERVAL

    this.#tokens = this.capacity
  }

  update(settings: TokenBucketSettings) {
    if (settings.capacity !== undefined) {
      const difference = settings.capacity - this.capacity
      this.#capacity = settings.capacity
      this.#tokens += difference
    }

    if (settings.rate !== undefined) {
      this.#rate = settings.rate
    }

    if (settings.interval !== undefined) {
      this.#interval = settings.interval
      if (this.running) {
        this.stop()
        this.start()
      }
    }
  }

  /**
   * Attempts to consume tokens from the bucket
   *
   * @param n - Number of tokens to consume
   * @returns Whether there were enough tokens
   */
  consume(n = 1): boolean {
    if (this.#tokens >= n) {
      this.#tokens -= n
      return true
    } else {
      return false
    }
  }

  /** Starts replenishing the bucket */
  start(): void {
    if (this.running) return

    this.#timer = setInterval(() => {
      this.#task()
    }, this.interval)
  }

  /** Stops replenishing the bucket */
  stop(): void {
    if (!this.running) return

    clearInterval(this.#timer)
    this.#timer = undefined
  }

  /** Whether the bucket is actively being replenished */
  get running(): boolean {
    return this.#timer !== undefined
  }

  /** https://nodejs.org/docs/latest/api/timers.html#timeoutref */
  ref(): void {
    this.#timer?.ref()
  }

  /** https://nodejs.org/docs/latest/api/timers.html#timeoutunref */
  unref(): void {
    this.#timer?.unref()
  }

  #task() {
    this.#tokens += this.rate
  }
}

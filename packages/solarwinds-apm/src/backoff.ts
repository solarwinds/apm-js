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

export interface BackoffOptions {
  /** Initial backoff time */
  initial: number
  /** Max backoff time */
  max?: number
  /** Multiplier to apply to each subsequent timeout */
  multiplier: number
  /** Number of retries before giving up */
  retries?: number
}

export class Backoff {
  readonly #backoff: {
    initial: number
    current: number
    max: number
  }
  readonly #multiplier: number

  readonly #retries?: {
    initial: number
    current: number
  }

  constructor(options: BackoffOptions) {
    if (options.initial <= 0) {
      throw new TypeError("initial backup value should be positive")
    }
    if (options.max !== undefined && options.max < options.initial) {
      throw new TypeError("max backoff should be greater than initial")
    }
    if (options.retries !== undefined && options.retries <= 0) {
      throw new Error("max retries should be positive")
    }

    this.#backoff = {
      initial: options.initial,
      current: options.initial,
      max: options.max ?? Number.POSITIVE_INFINITY,
    }
    this.#multiplier = options.multiplier

    if (options.retries) {
      this.#retries = {
        initial: options.retries,
        current: options.retries,
      }
    }
  }

  /** Resets the backoff to its initial state */
  reset(): void {
    this.#backoff.current = this.#backoff.initial

    if (this.#retries) {
      this.#retries.current = this.#retries.initial
    }
  }

  /** Returns the current backoff value or false if out of retries */
  backoff(): number | false {
    let current: number | false = this.#backoff.current

    this.#backoff.current = Math.min(
      current * this.#multiplier,
      this.#backoff.max,
    )

    if (this.#retries) {
      if (this.#retries.current === 0) {
        current = false
      } else {
        this.#retries.current -= 1
      }
    }

    return current
  }
}

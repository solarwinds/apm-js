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

export interface DiceSettings {
  /** Scale of the dice */
  scale: number
  /** Rate of rolls over the current scale that should be successful */
  rate?: number
}

export class Dice {
  #scale: number

  #r = 0
  get #rate(): number {
    return this.#r
  }
  set #rate(n: number) {
    this.#r = Math.max(0, Math.min(this.#scale, n))
  }

  constructor(settings: DiceSettings) {
    this.#scale = settings.scale
    this.#rate = settings.rate ?? 0
  }

  update(settings: Partial<DiceSettings>) {
    this.#scale = settings.scale ?? this.#scale
    this.#rate = settings.rate ?? this.#rate
  }

  roll(): boolean {
    return Math.random() * this.#scale < this.#rate
  }
}

/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

export interface DiceSettings {
	/** Scale of the dice. */
	scale: number
	/** Rate of rolls over the current scale that should be successful. */
	rate?: number
}

export class Dice {
	#scale: number

	#r = 0
	get rate(): number {
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
		this.#rate = settings.rate ?? this.rate
	}

	roll(): boolean {
		return Math.random() * this.#scale < this.rate
	}
}

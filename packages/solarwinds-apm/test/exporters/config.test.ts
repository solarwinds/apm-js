/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { type Agent } from "node:https"

import { describe, expect, it } from "@solarwinds-apm/test"

import { type Configuration } from "../../src/config.ts"
import { exporterConfig } from "../../src/exporters/config.ts"

const SIGNALS = ["traces", "metrics", "logs"] as const
const ENVS = ["cloud", "stage", "dev"]

describe(exporterConfig.name, () => {
	describe("swo endpoints", () => {
		for (const signal of SIGNALS) {
			for (const env of ENVS) {
				it(`returns the proper ${signal} config for ${env}`, () => {
					const url = `https://otel.collector.na-01.${env}.solarwinds.com/v1/${signal}`
					const config = {
						token: "token",
						otlp: { [signal]: url },
					} as Configuration

					const { httpAgentOptions, ...exporter } = exporterConfig(config, signal)!
					expect(exporter).to.loosely.deep.equal({
						url,
						headers: { authorization: "Bearer token" },
						compression: "gzip",
					})

					expect(httpAgentOptions).to.be.a("function")
				})
			}
		}
	})

	describe("custom endpoints", () => {
		for (const signal of SIGNALS) {
			it(`returns the proper ${signal} config`, async () => {
				const url = `https://localhost:4318/v1/${signal}`
				const config = {
					token: "token",
					otlp: { [signal]: url },
					trustedpath: "certificate",
				} as Configuration

				const { httpAgentOptions, ...exporter } = exporterConfig(config, signal)!
				expect(exporter).to.loosely.deep.equal({
					url,
					headers: {},
					compression: "gzip",
				})

				if (typeof httpAgentOptions === "function") {
					const agent = (await httpAgentOptions("https:")) as Agent
					expect(agent.options.ca).to.equal("certificate")
				} else {
					expect.fail("httpAgentOptions is not a function")
				}
			})
		}
	})

	describe("invalid endpoints", () => {
		for (const signal of SIGNALS) {
			it(`returns the proper ${signal} config`, async () => {
				const url = "invalid"
				const config = {
					token: "token",
					otlp: { [signal]: url },
					trustedpath: "certificate",
				} as Configuration

				const { httpAgentOptions, ...exporter } = exporterConfig(config, signal)!
				expect(exporter).to.loosely.deep.equal({
					url,
					headers: {},
					compression: "gzip",
				})

				if (typeof httpAgentOptions === "function") {
					const agent = (await httpAgentOptions("https:")) as Agent
					expect(agent.options.ca).to.equal("certificate")
				} else {
					expect.fail("httpAgentOptions is not a function")
				}
			})
		}
	})
})

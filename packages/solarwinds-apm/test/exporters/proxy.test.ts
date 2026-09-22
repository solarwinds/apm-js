/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import net from "node:net"

import { describe, expect, it } from "@solarwinds-apm/test"

import { type Configuration } from "../../src/config.ts"
import { agentFactory } from "../../src/exporters/proxy.ts"
import { get, proxy } from "../http.ts"

describe(agentFactory.name, () => {
	it("works when no proxy specified", async () => {
		const agent = await agentFactory({} as Configuration)("https:")
		const res = await get("https://solarwinds.com", agent)
		expect(res.statusCode).to.equal(200)
	}).timeout(10_000)

	it("works with public proxy", async () => {
		let proxied = false
		const [config, close] = await proxy((_, req, socket, head) => {
			const [hostname, port] = req.url!.split(":")
			const proxy = net.connect(Number(port), hostname, () => {
				proxied = true
				socket.write("HTTP/1.1 200\r\n\r\n")
				proxy.write(head)
				socket.pipe(proxy)
				proxy.pipe(socket)
			})
		})

		const agent = await agentFactory(config)("https:")
		const res = await get("https://solarwinds.com", agent)
		expect(res.statusCode).to.equal(200)
		expect(proxied).to.be.true

		await close()
	}).timeout(10_000)

	it("works with private proxy", async () => {
		let proxied = false
		const [unauthorizedConfig, close] = await proxy((_, req, socket, head) => {
			if (
				req.headers["proxy-authorization"] ===
				`Basic ${Buffer.from("Solar:Winds").toString("base64")}`
			) {
				const [hostname, port] = req.url!.split(":")
				const proxy = net.connect(Number(port), hostname, () => {
					proxied = true
					socket.write("HTTP/1.1 200\r\n\r\n")
					proxy.write(head)
					socket.pipe(proxy)
					proxy.pipe(socket)
				})
			} else {
				socket.write("HTTP/1.1 407 Proxy Authentication Required\r\n\r\n")
				socket.end()
			}
		})

		const config = {
			...unauthorizedConfig,
			proxy: new URL(unauthorizedConfig.proxy!),
		}
		config.proxy.username = "Solar"
		config.proxy.password = "Winds"

		const agent = await agentFactory(config)("https:")
		const res = await get("https://solarwinds.com", agent)
		expect(res.statusCode).to.equal(200)
		expect(proxied).to.be.true

		const unauthorizedAgent = await agentFactory(unauthorizedConfig)("https:")
		await expect(
			get("https://solarwinds.com", unauthorizedAgent),
		).to.eventually.be.rejectedWith(/Proxy Authentication Required/)

		await close()
	}).timeout(10_000)
})

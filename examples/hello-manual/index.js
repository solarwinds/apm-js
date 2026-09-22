/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import http from "node:http"

import { trace } from "@opentelemetry/api"

const server = http.createServer((req, res) => {
	const url = new URL(req.url, `http://${req.headers.host}`)
	const name = url.pathname.split("/")[1] ?? "World!"

	const tracer = trace.getTracer("hello-manual")
	tracer.startActiveSpan("handler", { attributes: { name } }, (span) => {
		res.writeHead(200, { "Content-Type": "text/plain" })
		res.end(`Hello, ${name}!`)

		span.end()
	})
})

const port = Number.parseInt(process.env.PORT) || 8080
server.listen(port)

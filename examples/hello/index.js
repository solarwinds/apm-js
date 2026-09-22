/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import http from "node:http"

const server = http.createServer((_req, res) => {
	res.writeHead(200, { "Content-Type": "text/plain" })
	res.end("Hello, World!")
})

const port = Number.parseInt(process.env.PORT) || 8080
server.listen(port)

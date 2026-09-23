/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import http from "node:http"

const server = http.createServer((_req, res) => {
	http.get("http://localhost:9090", (ires) => {
		res.writeHead(ires.statusCode, ires.headers)
		ires.pipe(res)
	})
})

const port = Number.parseInt(process.env.PORT) || 8080
server.listen(port)

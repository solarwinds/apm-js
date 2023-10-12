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

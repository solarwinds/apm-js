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

import type http from "node:http"
import type https from "node:https"
import { type Socket } from "node:net"

import { TimeoutError } from "@opentelemetry/core"
import { OTLPExporterError } from "@opentelemetry/otlp-exporter-base"

import { type Configuration } from "../config.js"

const IPV6_REGEX = /^\[(.*)\]$/

export const agentFactory =
  (config: Configuration) =>
  async (protocol: string): Promise<https.Agent> => {
    const { Agent } =
      protocol === "http:"
        ? await import("node:http")
        : await import("node:https")

    if (!config.proxy) {
      return new (Agent as typeof https.Agent)({ ca: config.trustedpath })
    }
    const proxy = {
      protocol: config.proxy.protocol,
      hostname: config.proxy.hostname.replace(IPV6_REGEX, "$1"),
      port: config.proxy.port,
      username: config.proxy.username,
      password: config.proxy.password,
    }

    const { request } =
      proxy.protocol === "http:"
        ? await import("node:http")
        : await import("node:https")

    const headers: http.OutgoingHttpHeaders = {
      ["Proxy-Connection"]: "keep-alive",
    }
    if (proxy.username) {
      const basic = `${proxy.username}:${proxy.password}`
      headers["Proxy-Authorization"] =
        `Basic ${Buffer.from(basic).toString("base64")}`
    }

    class ProxyAgent extends (Agent as typeof https.Agent) {
      // @ts-expect-error The types for the HTTP Agent are not quite right
      override createConnection(
        options: http.ClientRequestArgs,
        cb: (err: Error | null, conn?: Socket) => void,
      ): void {
        let host = options.hostname ?? "localhost"
        host = host.replace(IPV6_REGEX, "$1")

        /* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
        let port =
          options.port ||
          options.defaultPort ||
          (protocol === "http:" ? 80 : 443)
        if (typeof port === "string") {
          port = Number.parseInt(port, 10)
        }
        /* eslint-enable @typescript-eslint/prefer-nullish-coalescing */

        const req = (request as typeof https.request)({
          method: "CONNECT",
          host: proxy.hostname,
          port: proxy.port,
          path: `${host}:${port}`,
          headers,
          servername: proxy.hostname,
          ca: config.trustedpath,
          timeout: options.timeout,
        })

        req
          .on("connect", (res, conn) => {
            if (
              res.statusCode &&
              res.statusCode >= 200 &&
              res.statusCode < 300
            ) {
              if (protocol === "http:") {
                cb(null, conn)
              } else {
                import("node:tls")
                  .then((tls) => {
                    cb(
                      null,
                      tls.connect({
                        host,
                        port,
                        socket: conn,
                        servername: host,
                        ca: config.trustedpath,
                        timeout: options.timeout,
                      }),
                    )
                  })
                  .catch(cb)
              }
            } else {
              cb(new OTLPExporterError(res.statusMessage, res.statusCode))
            }
          })
          .on("timeout", () =>
            req.destroy(new TimeoutError("Proxy Request Timeout")),
          )
          .on("error", cb)
          .end()
      }
    }

    return new ProxyAgent({
      ca: config.trustedpath,
      keepAlive: true,
    }) as https.Agent
  }

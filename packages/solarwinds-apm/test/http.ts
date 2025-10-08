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

import http from "node:http"
import https from "node:https"
import type net from "node:net"
import { type Duplex } from "node:stream"

import { type Configuration } from "../src/config.js"

export const get = (url: string | URL, agent: http.Agent) => {
  url = new URL(url)
  const module = url.protocol === "http:" ? http : https

  return new Promise<http.IncomingMessage>((resolve, reject) =>
    module
      .get(url, { agent }, (res) => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res)
        } else if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          resolve(get(res.headers.location, agent))
        } else {
          console.dir(res)
          reject(new Error(res.statusMessage))
        }
        res.resume()
      })
      .on("error", reject)
      .end(),
  )
}

export const proxy = (
  connect: (
    server: http.Server,
    request: http.IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ) => void,
) =>
  new Promise<[config: Configuration, close: () => Promise<void>]>(
    (resolve, reject) => {
      const server = http
        .createServer((_, res) => {
          res.statusCode = 404
          res.end()
        })
        .on("error", reject)
      const sockets = new Set<net.Socket>()

      server
        .on("connect", (...args) => {
          connect(server, ...args)
        })
        .on("connection", (socket) => {
          sockets.add(socket)
          socket.on("close", () => sockets.delete(socket))
        })
        .on("listening", () => {
          const address = server.address() as net.AddressInfo
          const host = address.family.includes("6")
            ? `[${address.address}]`
            : address.address
          const port = address.port

          const config = {
            proxy: new URL(`http://${host}:${port}`),
          }

          const close = () =>
            new Promise<void>((resolve, reject) => {
              server.closeAllConnections()
              server.close((error) => {
                if (error) {
                  reject(error)
                } else {
                  resolve()
                }
              })

              for (const socket of sockets) {
                socket.emit("end")
                socket.emit("close")
                socket.destroy()
              }
            })

          resolve([config as Configuration, close])
        })
        .listen(0, "localhost")
        .unref()
    },
  )

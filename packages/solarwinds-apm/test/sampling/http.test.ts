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

import net from "node:net"
import os from "node:os"

import { trace } from "@opentelemetry/api"
import { before, describe, expect, it, otel } from "@solarwinds-apm/test"

import { type Configuration, read } from "../../src/config.js"
import { getter, hostname, HttpSampler } from "../../src/sampling/http.js"
import { proxy } from "../http.js"

expect(process.env).to.include.keys("SW_APM_COLLECTOR", "SW_APM_SERVICE_KEY")
const CONFIG = await read()

describe(hostname.name, () => {
  it("returns a properly encoded hostname", async () => {
    const name = await hostname()
    expect(decodeURIComponent(name)).to.equal(os.hostname())
  })
})

describe(getter.name, () => {
  const collector = new URL(
    "https://apm.collector.na-01.cloud.solarwinds.com/v1/settings/test/test",
  )

  it("works when no proxy specified", async () => {
    const get = await getter({ collector } as Configuration)
    const res = await get(collector, {})
    expect(res).to.include.keys("warning")
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

    const get = await getter({ ...config, collector })
    const res = await get(collector, {})
    expect(res).to.include.keys("warning")
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

    const get = await getter({ ...config, collector })
    const res = await get(collector, {})
    expect(res).to.include.keys("warning")
    expect(proxied).to.be.true

    const unauthorizedGet = await getter({ ...unauthorizedConfig, collector })
    await expect(unauthorizedGet(collector, {})).to.eventually.be.rejected

    await close()
  })
})

describe(HttpSampler.name, () => {
  describe("valid service key", () => {
    before(async () => {
      const config = { ...CONFIG }

      const sampler = new HttpSampler(config)
      await otel.reset({ trace: { sampler } })
      await sampler.waitUntilReady(1000)
    })

    it("samples created spans", async () => {
      const tracer = trace.getTracer("test")

      tracer.startActiveSpan("test", (span) => {
        expect(span.isRecording()).to.be.true
        span.end()
      })

      const span = (await otel.spans())[0]
      expect(span).not.to.be.undefined
      expect(span!.attributes).to.include.keys(
        "SampleRate",
        "SampleSource",
        "BucketCapacity",
        "BucketRate",
      )
    }).retries(10)
  })

  describe("invalid service key", () => {
    before(async () => {
      const config = { ...CONFIG, token: "OH NO" }

      const sampler = new HttpSampler(config)
      await otel.reset({ trace: { sampler } })
      await sampler.waitUntilReady(1000)
    })

    it("does not sample created spans", async () => {
      const tracer = trace.getTracer("test")

      tracer.startActiveSpan("test", (span) => {
        expect(span.isRecording()).to.be.false
        span.end()
      })

      const spans = await otel.spans()
      expect(spans).to.be.empty
    })
  })

  describe("invalid collector", () => {
    before(async () => {
      const config = {
        ...CONFIG,
        collector: new URL("https://collector.invalid"),
      }

      const sampler = new HttpSampler(config)
      await otel.reset({ trace: { sampler } })
      await sampler.waitUntilReady(1000)
    })

    it("does not sample created spans", async () => {
      const tracer = trace.getTracer("test")

      tracer.startActiveSpan("test", (span) => {
        expect(span.isRecording()).to.be.false
        span.end()
      })

      const spans = await otel.spans()
      expect(spans).to.be.empty
    })
  })
})

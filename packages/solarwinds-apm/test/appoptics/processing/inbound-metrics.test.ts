/*
Copyright 2023-2024 SolarWinds Worldwide, LLC.

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

import { SpanKind } from "@opentelemetry/api"
import { type ReadableSpan } from "@opentelemetry/sdk-trace-base"
import {
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_NETWORK_TRANSPORT,
  ATTR_URL_FULL,
} from "@opentelemetry/semantic-conventions"
import { describe, expect, it } from "@solarwinds-apm/test"

import { httpSpanMetadata } from "../../../src/appoptics/processing/inbound-metrics.js"
import {
  ATTR_HTTP_METHOD,
  ATTR_HTTP_STATUS_CODE,
  ATTR_HTTP_URL,
} from "../../../src/semattrs.old.js"

describe("httpSpanMetadata", () => {
  it("handles non-http spans properly", () => {
    const span = {
      kind: SpanKind.SERVER,
      attributes: { [ATTR_NETWORK_TRANSPORT]: "udp" },
    } as unknown as ReadableSpan

    const output = httpSpanMetadata(span)
    expect(output).to.deep.equal({ isHttp: false })
  })

  it("handles http client spans properly", () => {
    const span = {
      kind: SpanKind.CLIENT,
      attributes: {
        [ATTR_HTTP_REQUEST_METHOD]: "GET",
        [ATTR_HTTP_RESPONSE_STATUS_CODE]: 200,
        [ATTR_URL_FULL]: "https://solarwinds.com",
      },
    } as unknown as ReadableSpan

    const output = httpSpanMetadata(span)
    expect(output).to.deep.equal({ isHttp: false })
  })

  it("handles http server spans properly", () => {
    const span = {
      kind: SpanKind.SERVER,
      attributes: {
        [ATTR_HTTP_REQUEST_METHOD]: "GET",
        [ATTR_HTTP_RESPONSE_STATUS_CODE]: 200,
        [ATTR_URL_FULL]: "https://solarwinds.com",
      },
    } as unknown as ReadableSpan

    const output = httpSpanMetadata(span)
    expect(output).to.deep.equal({
      isHttp: true,
      method: "GET",
      status: 200,
      url: "https://solarwinds.com",
    })
  })

  it("handles legacy http server spans properly", () => {
    const span = {
      kind: SpanKind.SERVER,
      attributes: {
        [ATTR_HTTP_METHOD]: "GET",
        [ATTR_HTTP_STATUS_CODE]: "200",
        [ATTR_HTTP_URL]: "https://solarwinds.com",
      },
    } as unknown as ReadableSpan

    const output = httpSpanMetadata(span)
    expect(output).to.deep.equal({
      isHttp: true,
      method: "GET",
      status: 200,
      url: "https://solarwinds.com",
    })
  })
})

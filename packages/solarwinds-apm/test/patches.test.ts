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

import { type InstrumentationConfigMap } from "@solarwinds-apm/instrumentations"
import { describe, expect, it } from "@solarwinds-apm/test"

import { type Options, patch } from "../src/patches.js"

describe("patch", () => {
  const options: Options = {
    insertTraceContextIntoLogs: true,
    insertTraceContextIntoQueries: false,
    exportLogsEnabled: false,
  } as Options

  it("sets proper defaults", () => {
    const configs: InstrumentationConfigMap = {}

    patch(configs, options)
    expect(configs["@opentelemetry/instrumentation-aws-lambda"]).to.deep.equal({
      enabled: false,
    })
    expect(configs["@opentelemetry/instrumentation-aws-sdk"]).to.deep.equal({})
    expect(configs["@opentelemetry/instrumentation-fs"]).to.deep.equal({
      requireParentSpan: true,
    })
    expect(configs["@opentelemetry/instrumentation-mysql2"]).to.deep.equal({
      addSqlCommenterCommentToQueries: false,
    })
    expect(configs["@opentelemetry/instrumentation-pg"]).to.deep.equal({
      requireParentSpan: true,
      addSqlCommenterCommentToQueries: false,
    })

    expect(configs["@opentelemetry/instrumentation-bunyan"]).to.deep.include({
      enabled: true,
      disableLogSending: true,
    })
    expect(configs["@opentelemetry/instrumentation-pino"]).to.deep.include({
      enabled: true,
      disableLogSending: true,
    })
    expect(configs["@opentelemetry/instrumentation-winston"]).to.deep.include({
      enabled: true,
      disableLogSending: true,
    })
  })

  it("respects user values", () => {
    const configs: InstrumentationConfigMap = {
      "@opentelemetry/instrumentation-aws-lambda": {
        enabled: true,
      },
      "@opentelemetry/instrumentation-aws-sdk": {
        enabled: false,
      },
      "@opentelemetry/instrumentation-fs": {
        requireParentSpan: false,
      },
      "@opentelemetry/instrumentation-mysql2": {
        addSqlCommenterCommentToQueries: true,
      },
      "@opentelemetry/instrumentation-pg": {
        requireParentSpan: false,
        addSqlCommenterCommentToQueries: true,
      },

      "@opentelemetry/instrumentation-bunyan": {
        enabled: false,
        disableLogSending: false,
      },
      "@opentelemetry/instrumentation-winston": {
        enabled: false,
        disableLogSending: false,
      },
    }

    patch(configs, options)
    expect(configs["@opentelemetry/instrumentation-aws-lambda"]).to.deep.equal({
      enabled: true,
    })
    expect(configs["@opentelemetry/instrumentation-aws-sdk"]).to.deep.equal({
      enabled: false,
    })
    expect(configs["@opentelemetry/instrumentation-fs"]).to.deep.equal({
      requireParentSpan: false,
    })
    expect(configs["@opentelemetry/instrumentation-mysql2"]).to.deep.equal({
      addSqlCommenterCommentToQueries: true,
    })
    expect(configs["@opentelemetry/instrumentation-pg"]).to.deep.equal({
      requireParentSpan: false,
      addSqlCommenterCommentToQueries: true,
    })

    expect(configs["@opentelemetry/instrumentation-bunyan"]).to.deep.include({
      enabled: false,
      disableLogSending: false,
    })
    expect(configs["@opentelemetry/instrumentation-pino"]).to.deep.include({
      enabled: true,
      disableLogSending: true,
    })
    expect(configs["@opentelemetry/instrumentation-winston"]).to.deep.include({
      enabled: false,
      disableLogSending: false,
    })
  })
})

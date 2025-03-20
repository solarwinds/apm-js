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

import { resourceFromAttributes } from "@opentelemetry/resources"
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions"
import {
  ATTR_PROCESS_COMMAND_ARGS,
  ATTR_PROCESS_COMMAND_LINE,
} from "@opentelemetry/semantic-conventions/incubating"
import { describe, expect, it } from "@solarwinds-apm/test"

import { init } from "../../src/appoptics/reporter.js"

const lit = process.platform === "linux" ? it : it.skip.bind(it)

describe("init", () => {
  lit("has right basic properties", async () => {
    const message = Object.fromEntries(await init(resourceFromAttributes({})))

    expect(message).to.include({
      __Init: true,
      Layer: "nodejs",
      Label: "single",
    })
    expect(message).to.include.keys(["APM.Version", "APM.Extension.Version"])
  }).timeout(10_000)

  lit("forwards basic resource properties", async () => {
    const props = {
      s: "string",
      n: 2,
      b: true,
    }
    const message = Object.fromEntries(
      await init(resourceFromAttributes(props)),
    )

    expect(message).to.include(props)
  }).timeout(10_000)

  lit("doesn't forward service name", async () => {
    const message = Object.fromEntries(
      await init(resourceFromAttributes({ [ATTR_SERVICE_NAME]: "value" })),
    )

    expect(message).not.to.have.key(ATTR_SERVICE_NAME)
  }).timeout(10_000)

  lit("converts array resource properties", async () => {
    const message = Object.fromEntries(
      await init(
        resourceFromAttributes({
          array: [],
        }),
      ),
    )

    expect(message).to.include({
      array: "",
    })
  }).timeout(10_000)

  lit("converts process command args to command line", async () => {
    const message = Object.fromEntries(
      await init(
        resourceFromAttributes({
          [ATTR_PROCESS_COMMAND_ARGS]: ["node", "index.js"],
        }),
      ),
    )

    expect(message).to.include({
      [ATTR_PROCESS_COMMAND_LINE]: "node index.js",
    })
    expect(message).not.to.have.key(ATTR_PROCESS_COMMAND_ARGS)
  }).timeout(10_000)

  lit("doesn't override base attributes with resource attributes", async () => {
    const message = Object.fromEntries(
      await init(
        resourceFromAttributes({
          __Init: false,
          Layer: "python",
          Label: "multiple",
        }),
      ),
    )

    expect(message).to.include({
      __Init: true,
      Layer: "nodejs",
      Label: "single",
    })
  }).timeout(10_000)
})

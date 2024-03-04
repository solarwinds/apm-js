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

import { Resource } from "@opentelemetry/resources"
import {
  SEMRESATTRS_PROCESS_COMMAND_ARGS,
  SEMRESATTRS_PROCESS_COMMAND_LINE,
  SEMRESATTRS_SERVICE_NAME,
} from "@opentelemetry/semantic-conventions"
import { describe, expect, it } from "@solarwinds-apm/test"

import { initMessage } from "../src/reporter"

describe("initMessage", () => {
  it("has right basic properties", async () => {
    const message = await initMessage(new Resource({}), "1.0.0")

    expect(message).to.include({
      __Init: true,
      Layer: "nodejs",
      Label: "single",
    })
    expect(message).to.include.keys(["APM.Version", "APM.Extension.Version"])
  })

  it("forwards basic resource properties", async () => {
    const props = {
      s: "string",
      n: 2,
      b: true,
    }
    const message = await initMessage(new Resource(props), "1.0.0")

    expect(message).to.include(props)
  })

  it("doesn't forward service name", async () => {
    const message = await initMessage(
      new Resource({ [SEMRESATTRS_SERVICE_NAME]: "value" }),
      "1.0.0",
    )

    expect(message).not.to.have.key(SEMRESATTRS_SERVICE_NAME)
  })

  it("doesn't forward array or undefined resource properties", async () => {
    const message = await initMessage(
      new Resource({
        array: [],
        undefined: undefined,
      }),
      "1.0.0",
    )

    expect(message).not.to.have.any.keys(["array", "undefined"])
  })

  it("converts process command args to command line", async () => {
    const message = await initMessage(
      new Resource({
        [SEMRESATTRS_PROCESS_COMMAND_ARGS]: ["node", "index.js"],
      }),
      "1.0.0",
    )

    expect(message).to.include({
      [SEMRESATTRS_PROCESS_COMMAND_LINE]: "node index.js",
    })
    expect(message).not.to.have.key(SEMRESATTRS_PROCESS_COMMAND_ARGS)
  })

  it("doesn't override base attributes with resource attributes", async () => {
    const message = await initMessage(
      new Resource({
        __Init: false,
        Layer: "python",
        Label: "multiple",
      }),
      "1.0.0",
    )

    expect(message).to.include({
      __Init: true,
      Layer: "nodejs",
      Label: "single",
    })
  })
})

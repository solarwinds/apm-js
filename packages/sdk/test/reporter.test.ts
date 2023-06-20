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

import { Resource } from "@opentelemetry/resources"
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions"

import { initMessage } from "../src/reporter"

describe("initMessage", () => {
  it("has right basic properties", () => {
    const message = initMessage(new Resource({}))

    expect(message).toMatchObject({
      __Init: true,
      Layer: "nodejs",
      Label: "single",
    })
    expect(message).toContainKeys(["APM.Version", "APM.Extension.Version"])
  })

  it("forwards basic resource properties", () => {
    const props = {
      s: "string",
      n: 2,
      b: true,
    }
    const message = initMessage(new Resource(props))

    expect(message).toMatchObject(props)
  })

  it("doesn't forward service name", () => {
    const message = initMessage(
      new Resource({ [SemanticResourceAttributes.SERVICE_NAME]: "value" }),
    )

    expect(message).not.toContainKey(SemanticResourceAttributes.SERVICE_NAME)
  })

  it("doesn't forward array or undefined resource properties", () => {
    const message = initMessage(
      new Resource({
        array: [],
        undefined: undefined,
      }),
    )

    expect(message).not.toContainAnyKeys(["array", "undefined"])
  })

  it("converts process command args to command line", () => {
    const message = initMessage(
      new Resource({
        [SemanticResourceAttributes.PROCESS_COMMAND_ARGS]: ["node", "index.js"],
      }),
    )

    expect(message).toMatchObject({
      [SemanticResourceAttributes.PROCESS_COMMAND_LINE]: "node index.js",
    })
    expect(message).not.toContainKey(
      SemanticResourceAttributes.PROCESS_COMMAND_ARGS,
    )
  })

  it("doesn't override base attributes with resource attributes", () => {
    const message = initMessage(
      new Resource({
        __Init: false,
        Layer: "python",
        Label: "multiple",
      }),
    )

    expect(message).toMatchObject({
      __Init: true,
      Layer: "nodejs",
      Label: "single",
    })
  })
})

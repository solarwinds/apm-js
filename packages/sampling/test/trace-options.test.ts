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

import { describe, expect, it as test } from "@solarwinds-apm/test"

import {
  Auth,
  parseTraceOptions,
  stringifyTraceOptionsResponse,
  TriggerTrace,
  validateSignature,
} from "../src/trace-options.js"

describe("parseTraceOptions", () => {
  test("no key no value", () => {
    const header = "="
    const result = parseTraceOptions(header)

    expect(result).to.loosely.deep.equal({
      custom: {},
      ignored: [],
    })
  })

  test("orphan value", () => {
    const header = "=value"
    const result = parseTraceOptions(header)

    expect(result).to.loosely.deep.equal({
      custom: {},
      ignored: [],
    })
  })

  test("valid trigger trace", () => {
    const header = "trigger-trace"
    const result = parseTraceOptions(header)

    expect(result).to.loosely.deep.equal({
      triggerTrace: true,
      custom: {},
      ignored: [],
    })
  })

  test("trigger trace no value", () => {
    const header = "trigger-trace=value"
    const result = parseTraceOptions(header)

    expect(result).to.loosely.deep.equal({
      custom: {},
      ignored: [["trigger-trace", "value"]],
    })
  })

  test("trigger trace duplicate", () => {
    const header = "trigger-trace;trigger-trace"
    const result = parseTraceOptions(header)

    expect(result).to.loosely.deep.equal({
      triggerTrace: true,
      custom: {},
      ignored: [["trigger-trace", undefined]],
    })
  })

  test("timestamp no value", () => {
    const header = "ts"
    const result = parseTraceOptions(header)

    expect(result).to.loosely.deep.equal({
      custom: {},
      ignored: [["ts", undefined]],
    })
  })

  test("timestamp duplicate", () => {
    const header = "ts=1234;ts=5678"
    const result = parseTraceOptions(header)

    expect(result).to.loosely.deep.equal({
      timestamp: 1234,
      custom: {},
      ignored: [["ts", "5678"]],
    })
  })

  test("timestamp invalid", () => {
    const header = "ts=value"
    const result = parseTraceOptions(header)

    expect(result).to.loosely.deep.equal({
      custom: {},
      ignored: [["ts", "value"]],
    })
  })

  test("timestamp float", () => {
    const header = "ts=12.34"
    const result = parseTraceOptions(header)

    expect(result).to.loosely.deep.equal({
      custom: {},
      ignored: [["ts", "12.34"]],
    })
  })

  test("timestamp trim", () => {
    const header = "ts = 1234567890 "
    const result = parseTraceOptions(header)

    expect(result).to.loosely.deep.equal({
      timestamp: 1234567890,
      custom: {},
      ignored: [],
    })
  })

  test("sw-keys no value", () => {
    const header = "sw-keys"
    const result = parseTraceOptions(header)

    expect(result).to.loosely.deep.equal({
      custom: {},
      ignored: [["sw-keys", undefined]],
    })
  })

  test("sw-keys duplicate", () => {
    const header = "sw-keys=keys1;sw-keys=keys2"
    const result = parseTraceOptions(header)

    expect(result).to.loosely.deep.equal({
      swKeys: "keys1",
      custom: {},
      ignored: [["sw-keys", "keys2"]],
    })
  })

  test("sw-keys trim", () => {
    const header = "sw-keys= name:value "
    const result = parseTraceOptions(header)

    expect(result).to.loosely.deep.equal({
      swKeys: "name:value",
      custom: {},
      ignored: [],
    })
  })

  test("sw-keys ignore after semi", () => {
    const header = "sw-keys=check-id:check-1013,website-id;booking-demo"
    const result = parseTraceOptions(header)

    expect(result).to.loosely.deep.equal({
      swKeys: "check-id:check-1013,website-id",
      custom: {},
      ignored: [["booking-demo", undefined]],
    })
  })

  test("custom keys trim", () => {
    const header = "custom-key= value "
    const result = parseTraceOptions(header)

    expect(result).to.loosely.deep.equal({
      custom: {
        "custom-key": "value",
      },
      ignored: [],
    })
  })

  test("custom keys no value", () => {
    const header = "custom-key"
    const result = parseTraceOptions(header)

    expect(result).to.loosely.deep.equal({
      custom: {},
      ignored: [["custom-key", undefined]],
    })
  })

  test("custom keys duplicate", () => {
    const header = "custom-key=value1;custom-key=value2"
    const result = parseTraceOptions(header)

    expect(result).to.loosely.deep.equal({
      custom: { "custom-key": "value1" },
      ignored: [["custom-key", "value2"]],
    })
  })

  test("custom keys equals in value", () => {
    const header = "custom-key=name=value"
    const result = parseTraceOptions(header)

    expect(result).to.loosely.deep.equal({
      custom: {
        "custom-key": "name=value",
      },
      ignored: [],
    })
  })

  test("custom keys spaces in key", () => {
    const header = "custom- key=value;custom-ke y=value"
    const result = parseTraceOptions(header)

    expect(result).to.loosely.deep.equal({
      custom: {},
      ignored: [
        ["custom- key", "value"],
        ["custom-ke y", "value"],
      ],
    })
  })

  test("other ignored", () => {
    const header = "key=value"
    const result = parseTraceOptions(header)

    expect(result).to.loosely.deep.equal({
      custom: {},
      ignored: [["key", "value"]],
    })
  })

  test("trim everything", () => {
    const header =
      "trigger-trace ; custom-something=value; custom-OtherThing = other val ; sw-keys = 029734wr70:9wqj21,0d9j1 ; ts = 12345 ; foo = bar"
    const result = parseTraceOptions(header)

    expect(result).to.loosely.deep.equal({
      triggerTrace: true,
      swKeys: "029734wr70:9wqj21,0d9j1",
      timestamp: 12345,
      custom: {
        "custom-something": "value",
        "custom-OtherThing": "other val",
      },
      ignored: [["foo", "bar"]],
    })
  })

  test("semi everywhere", () => {
    const header =
      ";foo=bar;;;custom-something=value_thing;;sw-keys=02973r70:1b2a3;;;;custom-key=val;ts=12345;;;;;;;trigger-trace;;;"
    const result = parseTraceOptions(header)

    expect(result).to.loosely.deep.equal({
      triggerTrace: true,
      swKeys: "02973r70:1b2a3",
      timestamp: 12345,
      custom: {
        "custom-something": "value_thing",
        "custom-key": "val",
      },
      ignored: [["foo", "bar"]],
    })
  })

  test("single quotes", () => {
    const header = "trigger-trace;custom-foo='bar;bar';custom-bar=foo"
    const result = parseTraceOptions(header)

    expect(result).to.loosely.deep.equal({
      triggerTrace: true,
      custom: {
        "custom-foo": "'bar",
        "custom-bar": "foo",
      },
      ignored: [["bar'", undefined]],
    })
  })

  test("missing values and semi", () => {
    const header =
      ";trigger-trace;custom-something=value_thing;sw-keys=02973r70:9wqj21,0d9j1;1;2;3;4;5;=custom-key=val?;="
    const result = parseTraceOptions(header)

    expect(result).to.loosely.deep.equal({
      triggerTrace: true,
      swKeys: "02973r70:9wqj21,0d9j1",
      custom: {
        "custom-something": "value_thing",
      },
      ignored: [
        ["1", undefined],
        ["2", undefined],
        ["3", undefined],
        ["4", undefined],
        ["5", undefined],
      ],
    })
  })
})

describe("stringifyTraceOptionsResponse", () => {
  test("basic", () => {
    const result = stringifyTraceOptionsResponse({
      auth: Auth.OK,
      triggerTrace: TriggerTrace.OK,
    })

    expect(result).to.equal("auth=ok;trigger-trace=ok")
  })

  test("ignored values", () => {
    const result = stringifyTraceOptionsResponse({
      auth: Auth.OK,
      triggerTrace: TriggerTrace.TRIGGER_TRACING_DISABLED,
      ignored: ["invalid-key1", "invalid_key2"],
    })

    expect(result).to.equal(
      "auth=ok;trigger-trace=trigger-tracing-disabled;ignored=invalid-key1,invalid_key2",
    )
  })
})

describe("validateSignature", () => {
  test("valid signature", () => {
    const result = validateSignature(
      "trigger-trace;pd-keys=lo:se,check-id:123;ts=1564597681",
      "2c1c398c3e6be898f47f74bf74f035903b48b59c",
      "8mZ98ZnZhhggcsUmdMbS",
      Date.now() / 1000 - 60,
    )

    expect(result).to.equal(Auth.OK)
  })

  test("invalid signature", () => {
    const result = validateSignature(
      "trigger-trace;pd-keys=lo:se,check-id:123;ts=1564597681",
      "2c1c398c3e6be898f47f74bf74f035903b48b59d",
      "8mZ98ZnZhhggcsUmdMbS",
      Date.now() / 1000 - 60,
    )

    expect(result).to.equal(Auth.BAD_SIGNATURE)
  })

  test("missing signature key", () => {
    const result = validateSignature(
      "trigger-trace;pd-keys=lo:se,check-id:123;ts=1564597681",
      "2c1c398c3e6be898f47f74bf74f035903b48b59c",
      undefined,
      Date.now() / 1000 - 60,
    )

    expect(result).to.equal(Auth.NO_SIGNATURE_KEY)
  })

  test("timestamp past", () => {
    const result = validateSignature(
      "trigger-trace;pd-keys=lo:se,check-id:123;ts=1564597681",
      "2c1c398c3e6be898f47f74bf74f035903b48b59c",
      "8mZ98ZnZhhggcsUmdMbS",
      Date.now() / 1000 - 10 * 60,
    )

    expect(result).to.equal(Auth.BAD_TIMESTAMP)
  })

  test("timestamp future", () => {
    const result = validateSignature(
      "trigger-trace;pd-keys=lo:se,check-id:123;ts=1564597681",
      "2c1c398c3e6be898f47f74bf74f035903b48b59c",
      "8mZ98ZnZhhggcsUmdMbS",
      Date.now() / 1000 + 10 * 60,
    )

    expect(result).to.equal(Auth.BAD_TIMESTAMP)
  })

  test("missing timestamp", () => {
    const result = validateSignature(
      "trigger-trace;pd-keys=lo:se,check-id:123;ts=1564597681",
      "2c1c398c3e6be898f47f74bf74f035903b48b59c",
      "8mZ98ZnZhhggcsUmdMbS",
      undefined,
    )

    expect(result).to.equal(Auth.BAD_TIMESTAMP)
  })
})

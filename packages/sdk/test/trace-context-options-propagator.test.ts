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

import { type TraceOptions } from "../src/context"
import { SwTraceContextOptionsPropagator } from "../src/trace-context-options-propagator"
import * as mock from "./mock"

const propagator = new SwTraceContextOptionsPropagator(mock.logger())

const parseTraceOptions = "parseTraceOptions"
describe(parseTraceOptions, () => {
  test("no key no value", () => {
    const header = "="
    const result = propagator[parseTraceOptions]("=")

    expect(result).to.loosely.deep.equal({
      header,
      custom: {},
      ignored: [],
    } satisfies TraceOptions)
  })

  test("orphan value", () => {
    const header = "=value"
    const result = propagator[parseTraceOptions](header)

    expect(result).to.loosely.deep.equal({
      header,
      custom: {},
      ignored: [],
    } satisfies TraceOptions)
  })

  test("valid trigger trace", () => {
    const header = "trigger-trace"
    const result = propagator[parseTraceOptions](header)

    expect(result).to.loosely.deep.equal({
      header,
      triggerTrace: true,
      custom: {},
      ignored: [],
    } satisfies TraceOptions)
  })

  test("invalid trigger trace with value", () => {
    const header = "trigger-trace=value"
    const result = propagator[parseTraceOptions](header)

    expect(result).to.loosely.deep.equal({
      header,
      custom: {},
      ignored: [["trigger-trace", "value"]],
    } satisfies TraceOptions)
  })

  test("sw-keys strip", () => {
    const header = "sw-keys= name:value "
    const result = propagator[parseTraceOptions](header)

    expect(result).to.loosely.deep.equal({
      header,
      swKeys: "name:value",
      custom: {},
      ignored: [],
    } satisfies TraceOptions)
  })

  test("sw-keys ignore after semi", () => {
    const header = "sw-keys=check-id:check-1013,website-id;booking-demo"
    const result = propagator[parseTraceOptions](header)

    expect(result).to.loosely.deep.equal({
      header,
      swKeys: "check-id:check-1013,website-id",
      custom: {},
      ignored: [["booking-demo", undefined]],
    } satisfies TraceOptions)
  })

  test("custom keys strip", () => {
    const header = "custom-key= value "
    const result = propagator[parseTraceOptions](header)

    expect(result).to.loosely.deep.equal({
      header,
      custom: {
        "custom-key": "value",
      },
      ignored: [],
    } satisfies TraceOptions)
  })

  test("custom keys ignore no value", () => {
    const header = "custom-key"
    const result = propagator[parseTraceOptions](header)

    expect(result).to.loosely.deep.equal({
      header,
      custom: {},
      ignored: [["custom-key", undefined]],
    } satisfies TraceOptions)
  })

  test("custom keys equals in value", () => {
    const header = "custom-key=name=value"
    const result = propagator[parseTraceOptions](header)

    expect(result).to.loosely.deep.equal({
      header,
      custom: {
        "custom-key": "name=value",
      },
      ignored: [],
    } satisfies TraceOptions)
  })

  test("custom keys ignore spaces in key", () => {
    const header = "custom- key=value;custom-ke y=value"
    const result = propagator[parseTraceOptions](header)

    expect(result).to.loosely.deep.equal({
      header,
      custom: {},
      ignored: [
        ["custom- key", "value"],
        ["custom-ke y", "value"],
      ],
    } satisfies TraceOptions)
  })

  test("timestamp trim", () => {
    const header = "ts = 1234567890 "
    const result = propagator[parseTraceOptions](header)

    expect(result).to.loosely.deep.equal({
      header,
      timestamp: 1234567890,
      custom: {},
      ignored: [],
    } satisfies TraceOptions)
  })

  test("other ignored", () => {
    const header = "key=value"
    const result = propagator[parseTraceOptions](header)

    expect(result).to.loosely.deep.equal({
      header,
      custom: {},
      ignored: [["key", "value"]],
    } satisfies TraceOptions)
  })

  test("signature", () => {
    const header = "foo bar baz"
    const signature = "signature123"
    const result = propagator[parseTraceOptions](header, signature)

    expect(result).to.loosely.deep.equal({
      header,
      signature,
      custom: {},
      ignored: [["foo bar baz", undefined]],
    } satisfies TraceOptions)
  })

  test("strip everything", () => {
    const header =
      "trigger-trace ; custom-something=value; custom-OtherThing = other val ; sw-keys = 029734wr70:9wqj21,0d9j1 ; ts = 12345 ; foo = bar"
    const result = propagator[parseTraceOptions](header)

    expect(result).to.loosely.deep.equal({
      header,
      triggerTrace: true,
      swKeys: "029734wr70:9wqj21,0d9j1",
      timestamp: 12345,
      custom: {
        "custom-something": "value",
        "custom-OtherThing": "other val",
      },
      ignored: [["foo", "bar"]],
    } satisfies TraceOptions)
  })

  test("semi everywhere", () => {
    const header =
      ";foo=bar;;;custom-something=value_thing;;sw-keys=02973r70:1b2a3;;;;custom-key=val;ts=12345;;;;;;;trigger-trace;;;"
    const result = propagator[parseTraceOptions](header)

    expect(result).to.loosely.deep.equal({
      header,
      triggerTrace: true,
      swKeys: "02973r70:1b2a3",
      timestamp: 12345,
      custom: {
        "custom-something": "value_thing",
        "custom-key": "val",
      },
      ignored: [["foo", "bar"]],
    } satisfies TraceOptions)
  })

  test("single quotes", () => {
    const header = "trigger-trace;custom-foo='bar;bar';custom-bar=foo"
    const result = propagator[parseTraceOptions](header)

    expect(result).to.loosely.deep.equal({
      header,
      triggerTrace: true,
      custom: {
        "custom-foo": "'bar",
        "custom-bar": "foo",
      },
      ignored: [["bar'", undefined]],
    } satisfies TraceOptions)
  })

  test("missing values and semi", () => {
    const header =
      ";trigger-trace;custom-something=value_thing;sw-keys=02973r70:9wqj21,0d9j1;1;2;3;4;5;=custom-key=val?;="
    const result = propagator[parseTraceOptions](header)

    expect(result).to.loosely.deep.equal({
      header,
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
    } satisfies TraceOptions)
  })
})

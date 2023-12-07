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

import { describe, expect, it } from "@solarwinds-apm/test"

import { cache } from "../src/cache"
import { type SwConfiguration } from "../src/config"
import * as mock from "./mock"

describe("Cache", () => {
  describe("getTxname", () => {
    it("uses txname when present", () => {
      const ctx = mock.spanContext()
      cache.getOrInit(ctx, { txname: "txname" })

      const txname = cache.getTxname(ctx, {} as SwConfiguration)
      expect(txname).to.equal("txname")
    })

    it("prefers config value over txname", () => {
      const ctx = mock.spanContext()
      cache.getOrInit(ctx, { txname: "txname" })

      const txname = cache.getTxname(ctx, {
        transactionName: "transactionName",
      } as SwConfiguration)
      expect(txname).to.equal("transactionName")
    })

    it("prefers txnameCustom over config value", () => {
      const ctx = mock.spanContext()
      cache.getOrInit(ctx, { txname: "txname", txnameCustom: "txnameCustom" })

      const txname = cache.getTxname(ctx, {
        transactionName: "transactionName",
      } as SwConfiguration)
      expect(txname).to.equal("txnameCustom")
    })
  })
})

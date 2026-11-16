/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

const apm = require("../index.cjs")
const assert = require("assert")

void (async () => {
	assert.equal(await apm.waitUntilReady(), false)
	assert.equal(apm.setTransactionName("test"), false)
	await apm.forceFlush()
})()

const apm = require("../index.cjs")
const assert = require("assert")

void (async () => {
	assert.equal(await apm.waitUntilReady(), false)
	assert.equal(apm.setTransactionName("test"), false)
	await apm.forceFlush()
})()

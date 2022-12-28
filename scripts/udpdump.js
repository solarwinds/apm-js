const dgram = require("node:dgram")
const bson = require("bson")

const socket = dgram.createSocket("udp4")

socket.on("message", (msg) => {
  const msgs = []
  for (let bufIdx = 0, msgIdx = 0; bufIdx < msg.length; msgIdx++) {
    bufIdx = bson.deserializeStream(msg, bufIdx, 1, msgs, msgIdx)
  }
  for (const m of msgs) {
    console.log(m)
  }
})

socket.bind(12225)

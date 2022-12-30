const express = require("express")
const app = express()

app.get("/hello/:name", (req, res) => {
  res.send(`Hello, ${req.params.name}!`)
})

app.get("/self", async (_req, res) => {
  res.sendFile(__filename)
})

const port = Number.parseInt(process.env.PORT) || 8080
app.listen(port)

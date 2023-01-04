const { TOKEN } = require("./shared")
const axios = require("axios")
const express = require("express")
const app = express()

app.get("/hello/:name", async (req, res) => {
  const apiRes = await axios.post(
    "http://localhost:9090/api/hello",
    { name: req.params.name },
    { headers: { authorization: `Bearer ${TOKEN}` } },
  )
  res.send(apiRes.data.message)
})

const port = Number.parseInt(process.env.PORT) || 8080
app.listen(port)

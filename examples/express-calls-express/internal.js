const { TOKEN } = require("./shared")
const express = require("express")
const app = express()

app.use(express.json())
app.use((req, res, next) => {
  if (req.get("authorization") !== `Bearer ${TOKEN}`) {
    res.status(401).send("Unauthorized")
    return
  }
  next()
})

app.post("/api/hello", (req, res) => {
  res.json({ message: `Hello, ${req.body.name}!` })
})

const port = 9090
app.listen(port)

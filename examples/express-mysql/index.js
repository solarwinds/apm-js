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

const process = require("node:process")

const express = require("express")
const mysql = require("mysql2")
const winston = require("winston")

const logger = winston.createLogger({
  transports: [new winston.transports.Console()],
})

const conn = mysql.createConnection({
  host: "mysql",
  user: "root",
  password: "root",
  database: "todo",
})
const schema = `
CREATE TABLE IF NOT EXISTS items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  description TEXT NOT NULL,
  done TINYINT NOT NULL DEFAULT(0)
)
`

const app = express()
app.use(express.json())

app.get("/", (_req, res) => {
  conn.query("SELECT * FROM items", (err, rows) => {
    if (err) {
      logger.error(err)
      res.sendStatus(500)
    } else {
      res.json(
        rows.map(({ id, description, done }) => ({
          id,
          description,
          done: Boolean(done),
        })),
      )
    }
  })
})

app.post("/", (req, res) => {
  const description = req.body.description
  if (typeof description !== "string") {
    res.status(400)
    res.send("expected description string")
    return
  }

  conn.query(
    "INSERT INTO items (description) VALUES (?)",
    [description],
    (err, result) => {
      if (err) {
        logger.error(err)
        res.sendStatus(500)
      } else {
        res.status(201)
        res.json({
          id: result.insertId,
          description,
          done: false,
        })
      }
    },
  )
})

app.get("/:id", (req, res) => {
  const id = Number.parseInt(req.params.id)
  if (!id || id < 0) {
    res.status(400)
    res.send("expected positive id")
    return
  }

  conn.query("SELECT * FROM items WHERE id = ?", [id], (err, rows) => {
    if (err) {
      logger.error(err)
      res.sendStatus(500)
    } else {
      const items = rows.map(({ id, description, done }) => ({
        id,
        description,
        done: Boolean(done),
      }))
      if (items.length > 0) {
        res.json(items[0])
      } else {
        res.sendStatus(404)
      }
    }
  })
})

app.patch("/:id", (req, res) => {
  const id = Number.parseInt(req.params.id)
  if (!id || id < 0) {
    res.status(400)
    res.send("expected positive id")
    return
  }

  const done = req.body.done
  if (typeof done !== "boolean") {
    res.status(400)
    res.send("expected done status")
    return
  }

  conn.query(
    "UPDATE items SET done = ? WHERE id = ?",
    [done, id],
    (err, result) => {
      if (err) {
        logger.error(err)
        res.sendStatus(500)
      } else {
        if (result.affectedRows > 0) {
          res.sendStatus(204)
        } else {
          res.sendStatus(404)
        }
      }
    },
  )
})

const port = Number.parseInt(process.env.PORT) || 8080
app.listen(port, () => {
  conn.query(schema, (err) => {
    if (err) {
      logger.error(err)
      process.exit(1)
    }

    logger.info(`listening on port ${port}`)
  })
})

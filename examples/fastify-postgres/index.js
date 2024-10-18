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

import { env } from "node:process"

import pg from "@fastify/postgres"
import fastify from "fastify"
import { setTransactionName } from "solarwinds-apm"

const schema = `
CREATE TABLE IF NOT EXISTS items (
  id SERIAL PRIMARY KEY,
  description TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT(FALSE)
)
`

const app = fastify({ logger: true })
app.register(pg, {
  host: "postgres",
  user: "postgres",
  password: "postgres",
  database: "todo",
})

app.get("/", async () => {
  const { rows } = await app.pg.query("SELECT * FROM items")
  return rows
})

app.post(
  "/",
  {
    schema: {
      body: {
        type: "object",
        properties: { description: { type: "string" } },
        required: ["description"],
      },
    },
  },
  async (req, res) => {
    const { rows } = await app.pg.query(
      "INSERT INTO items (description) VALUES ($1) RETURNING *",
      [req.body.description],
    )
    res.code(201)
    return rows[0]
  },
)

app.get("/error", () => {
  setTransactionName("woops")
  throw new Error("woops")
})

app.get(
  "/:id",
  {
    schema: {
      params: {
        type: "object",
        properties: { id: { type: "integer", minimum: 0 } },
      },
    },
  },
  async (req, res) => {
    const { rows } = await app.pg.query("SELECT * FROM items WHERE id = $1", [
      req.params.id,
    ])
    if (rows.length > 0) {
      return rows[0]
    } else {
      res.code(404)
    }
  },
)

app.patch(
  "/:id",
  {
    schema: {
      params: {
        type: "object",
        properties: { id: { type: "integer", minimum: 0 } },
      },
      body: {
        type: "object",
        properties: { done: { type: "boolean" } },
        required: ["done"],
      },
    },
  },
  async (req, res) => {
    const { rows } = await app.pg.query(
      "UPDATE items SET done = $2 WHERE id = $1 RETURNING *",
      [req.params.id, req.body.done],
    )
    if (rows.length > 0) {
      return rows[0]
    } else {
      res.code(404)
    }
  },
)

const port = Number.parseInt(env.PORT) || 8080
await app.listen({ port, host: "0.0.0.0" })
await app.pg.query(schema)

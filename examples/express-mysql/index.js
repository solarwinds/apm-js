/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

const process = require("node:process")

const express = require("express")
const mysql = require("mysql2")
const apm = require("solarwinds-apm")
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

	conn.query("INSERT INTO items (description) VALUES (?)", [description], (err, result) => {
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
	})
})

app.get("/error", () => {
	apm.setTransactionName("woops")
	throw new Error("woops")
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

	conn.query("UPDATE items SET done = ? WHERE id = ?", [done, id], (err, result) => {
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
	})
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

"use server"

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import { PrismaClient, type Item } from "./db/client"
import { revalidatePath } from "next/cache"

let client: PrismaClient | undefined
function db(): PrismaClient {
  return (client ??= new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: "./prisma/db.sqlite" }),
  }))
}

export async function listItems(done: boolean): Promise<Item[]> {
  return await db().item.findMany({ where: { done } })
}

export async function newOrDone(data: FormData) {
  const done = data.get("done")
  if (done) {
    const id = Number.parseInt(done?.toString() ?? "")
    await db().item.update({ data: { done: true }, where: { id } })

    revalidatePath("/@todo")
    revalidatePath("/@done")
  } else {
    const description = data.get("description")!.toString()
    await db().item.create({ data: { description } })

    revalidatePath("/@todo")
  }
}

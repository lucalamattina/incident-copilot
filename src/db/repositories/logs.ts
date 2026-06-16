import type { Kysely } from "kysely";
import type { Database } from "../client";
import type { Log } from "../../domain/types";

/** Bulk-insert logs. No-op on an empty array. */
export async function insertLogs(db: Kysely<Database>, rows: readonly Log[]): Promise<void> {
  if (rows.length === 0) return;
  await db.insertInto("logs").values([...rows]).execute();
}

/** All logs, newest first (ties broken by id for determinism). */
export async function listLogs(db: Kysely<Database>): Promise<Log[]> {
  return db
    .selectFrom("logs")
    .selectAll()
    .orderBy("timestamp", "desc")
    .orderBy("id", "asc")
    .execute();
}

export async function countLogs(db: Kysely<Database>): Promise<number> {
  const row = await db
    .selectFrom("logs")
    .select((eb) => eb.fn.countAll<string>().as("count"))
    .executeTakeFirstOrThrow();
  return Number(row.count);
}

import type { Kysely } from "kysely";
import type { Database } from "../client";
import type { Deploy } from "../../domain/types";

/** Bulk-insert deploys. No-op on an empty array. */
export async function insertDeploys(db: Kysely<Database>, rows: readonly Deploy[]): Promise<void> {
  if (rows.length === 0) return;
  await db.insertInto("deploys").values([...rows]).execute();
}

/** All deploys, newest first (ties broken by id for determinism). */
export async function listDeploys(db: Kysely<Database>): Promise<Deploy[]> {
  return db
    .selectFrom("deploys")
    .selectAll()
    .orderBy("timestamp", "desc")
    .orderBy("id", "asc")
    .execute();
}

export async function countDeploys(db: Kysely<Database>): Promise<number> {
  const row = await db
    .selectFrom("deploys")
    .select((eb) => eb.fn.countAll<string>().as("count"))
    .executeTakeFirstOrThrow();
  return Number(row.count);
}

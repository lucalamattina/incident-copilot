import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import { loadConfig } from "../config";

/**
 * The Kysely database schema. Tables are added to this interface as later
 * milestones introduce them (deploys and logs in M2, playbook chunks in M4).
 */
export interface Database {}

let db: Kysely<Database> | undefined;

/** Lazily construct a single shared Kysely instance backed by a pg pool. */
export function getDb(): Kysely<Database> {
  if (!db) {
    const { DATABASE_URL } = loadConfig();
    db = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new pg.Pool({ connectionString: DATABASE_URL }),
      }),
    });
  }
  return db;
}

/** Close the pool. Call from test teardown and on process shutdown. */
export async function closeDb(): Promise<void> {
  if (db) {
    await db.destroy();
    db = undefined;
  }
}

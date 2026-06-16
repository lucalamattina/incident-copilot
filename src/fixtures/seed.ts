import { pathToFileURL } from "node:url";
import type { Kysely } from "kysely";
import { getDb, closeDb, type Database } from "../db/client";
import { migrateToLatest } from "../db/migrate";
import { insertDeploys } from "../db/repositories/deploys";
import { insertLogs } from "../db/repositories/logs";
import { DEPLOYS } from "./deploys";
import { LOGS } from "./logs";

/**
 * Seed the database with the fixtures. Idempotent and deterministic: clears
 * both tables and re-inserts, so re-running always yields the same data rather
 * than duplicating it.
 */
export async function seed(db: Kysely<Database>): Promise<{ deploys: number; logs: number }> {
  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom("logs").execute();
    await trx.deleteFrom("deploys").execute();
    await insertDeploys(trx, DEPLOYS);
    await insertLogs(trx, LOGS);
  });
  return { deploys: DEPLOYS.length, logs: LOGS.length };
}

// CLI entry: `tsx src/fixtures/seed.ts`. Ensures the schema exists, then seeds.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    await migrateToLatest();
    const counts = await seed(getDb());
    console.log(`seeded ${counts.deploys} deploys and ${counts.logs} logs`);
    await closeDb();
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

import { pathToFileURL } from "node:url";
import { Migrator, type Migration, type MigrationProvider } from "kysely/migration";
import { getDb, closeDb, type Database } from "./client";
import type { Kysely } from "kysely";
import * as migration0001 from "./migrations/0001_deploys_logs";
import * as migration0002 from "./migrations/0002_playbook_chunks";

/**
 * Static, in-code migration provider. Avoids the filesystem/ESM friction of
 * FileMigrationProvider by listing migrations explicitly.
 */
const provider: MigrationProvider = {
  async getMigrations(): Promise<Record<string, Migration>> {
    return {
      "0001_deploys_logs": { up: migration0001.up, down: migration0001.down },
      "0002_playbook_chunks": { up: migration0002.up, down: migration0002.down },
    };
  },
};

export async function migrateToLatest(db: Kysely<Database> = getDb()) {
  const migrator = new Migrator({ db, provider });
  const { error, results } = await migrator.migrateToLatest();
  for (const r of results ?? []) {
    if (r.status === "Success") console.log(`migration ${r.migrationName} applied`);
    else if (r.status === "Error") console.error(`migration ${r.migrationName} failed`);
  }
  if (error) throw error;
  return results;
}

// CLI entry: `tsx src/db/migrate.ts`.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  migrateToLatest()
    .then(() => closeDb())
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

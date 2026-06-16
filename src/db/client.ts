import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import { loadConfig } from "../config";
import type { Service } from "../domain/services";
import type { DeployStatus, LogLevel } from "../domain/types";

/** `deploys` table: one row per release event. Mirrors the Deploy domain type. */
export interface DeploysTable {
  id: string;
  service: Service;
  timestamp: Date;
  version: string;
  status: DeployStatus;
  author: string;
  summary: string;
}

/** `logs` table: one row per log line. Mirrors the Log domain type. */
export interface LogsTable {
  id: string;
  service: Service;
  timestamp: Date;
  level: LogLevel;
  message: string;
}

/**
 * The Kysely database schema. Playbook chunks (with a vector column) are added
 * in M4.
 */
export interface Database {
  deploys: DeploysTable;
  logs: LogsTable;
}

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

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

/** `playbooks` table: one row per parent playbook (returned whole by retrieval). */
export interface PlaybooksTable {
  id: string;
  title: string;
  trigger: string;
  service: Service | null;
  body: string;
}

/**
 * `playbook_chunks` table: one row per chunk, each linked to its parent
 * playbook. `embedding` is a pgvector(384) column, represented as its string
 * literal (`[v1,v2,...]`) on both insert and select.
 */
export interface PlaybookChunksTable {
  id: string;
  playbook_id: string;
  chunk_index: number;
  content: string;
  embedding: string;
}

/** The Kysely database schema. */
export interface Database {
  deploys: DeploysTable;
  logs: LogsTable;
  playbooks: PlaybooksTable;
  playbook_chunks: PlaybookChunksTable;
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

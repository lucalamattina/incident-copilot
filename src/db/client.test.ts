import { describe, it, expect, afterAll } from "vitest";
import { sql } from "kysely";
import { getDb, closeDb } from "./client";

/**
 * Infrastructure smoke test: requires `npm run db:up`. Confirms we can reach
 * Postgres and that the pgvector extension is installed, so later milestones
 * can rely on vector columns.
 */
describe("database infrastructure", () => {
  afterAll(async () => {
    await closeDb();
  });

  it("connects and has the pgvector extension installed", async () => {
    const db = getDb();
    const result = await sql<{ extname: string }>`
      SELECT extname FROM pg_extension WHERE extname = 'vector'
    `.execute(db);
    expect(result.rows.map((r) => r.extname)).toContain("vector");
  });
});

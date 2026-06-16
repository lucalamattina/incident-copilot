import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "kysely";
import { getDb, closeDb } from "../db/client";
import { migrateToLatest } from "../db/migrate";
import { ingest, PLAYBOOKS_DIR } from "./ingest";
import { FakeEmbedder } from "./embeddings.test";

/**
 * Integration test against the local Postgres (requires `npm run db:up`). Uses
 * the FakeEmbedder so the pipeline and storage are tested without the model or
 * network, exercising the swappable-embedder design.
 */
describe("RAG ingestion (integration)", () => {
  const db = getDb();
  let result: { playbooks: number; chunks: number };

  beforeAll(async () => {
    await migrateToLatest(db);
    result = await ingest(db, new FakeEmbedder(), PLAYBOOKS_DIR);
  });

  afterAll(async () => {
    await closeDb();
  });

  async function count(table: "playbooks" | "playbook_chunks"): Promise<number> {
    const row = await db
      .selectFrom(table)
      .select((eb) => eb.fn.countAll<string>().as("n"))
      .executeTakeFirstOrThrow();
    return Number(row.n);
  }

  it("ingests all 15 playbooks and reports a chunk count", async () => {
    expect(result.playbooks).toBe(15);
    expect(result.chunks).toBeGreaterThan(0);
    expect(await count("playbooks")).toBe(15);
    expect(await count("playbook_chunks")).toBe(result.chunks);
  });

  it("links every chunk to an existing parent playbook (no orphans)", async () => {
    const orphans = await db
      .selectFrom("playbook_chunks as c")
      .leftJoin("playbooks as p", "p.id", "c.playbook_id")
      .where("p.id", "is", null)
      .select("c.id")
      .execute();
    expect(orphans).toHaveLength(0);
  });

  it("chunks a known playbook into multiple sequential chunks", async () => {
    const chunks = await db
      .selectFrom("playbook_chunks")
      .select(["id", "chunk_index"])
      .where("playbook_id", "=", "postgres-primary-failover")
      .orderBy("chunk_index", "asc")
      .execute();
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c, i) => expect(c.chunk_index).toBe(i));
  });

  it("stores a 384-dim vector embedding per chunk", async () => {
    const row = await db
      .selectFrom("playbook_chunks")
      .select(["embedding"])
      .limit(1)
      .executeTakeFirstOrThrow();
    expect(typeof row.embedding).toBe("string");
    expect(row.embedding.startsWith("[")).toBe(true);
    // pgvector serialises as "[v1,v2,...]"; 384 values => 383 commas.
    expect((row.embedding.match(/,/g) ?? []).length).toBe(383);

    const dims = await db
      .selectFrom("playbook_chunks")
      .select(sql<number>`vector_dims(embedding)`.as("dims"))
      .limit(1)
      .executeTakeFirstOrThrow();
    expect(Number(dims.dims)).toBe(384);
  });

  it("is idempotent: re-ingesting yields the same counts", async () => {
    const again = await ingest(db, new FakeEmbedder(), PLAYBOOKS_DIR);
    expect(again.playbooks).toBe(15);
    expect(await count("playbooks")).toBe(15);
    expect(await count("playbook_chunks")).toBe(again.chunks);
  });
});

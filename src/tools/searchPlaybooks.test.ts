import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb, closeDb } from "../db/client";
import { migrateToLatest } from "../db/migrate";
import { ingest, PLAYBOOKS_DIR } from "../rag/ingest";
import { createEmbedder } from "../rag/embeddings";
import { retrievePlaybooks } from "../rag/retrieve";
import { searchPlaybooks } from "./searchPlaybooks";
import { executeTool } from "./index";

/**
 * Integration test against the local Postgres (requires `npm run db:up`). Uses
 * the REAL embedder and ingests real vectors, because retrieval quality is the
 * thing under test here.
 */
describe("search_playbooks retrieval (integration)", () => {
  const db = getDb();
  const embedder = createEmbedder();

  beforeAll(async () => {
    await migrateToLatest(db);
    await ingest(db, embedder, PLAYBOOKS_DIR);
  });

  afterAll(async () => {
    await closeDb();
  });

  it("returns the failover playbook as the top result (Tier-one anchor)", async () => {
    const matches = await retrievePlaybooks(
      db,
      embedder,
      "the primary postgres database is down, show me the failover steps",
    );
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].playbook.id).toBe("postgres-primary-failover");
  });

  it("returns whole parent playbooks, each once (rollup + dedup)", async () => {
    const matches = await retrievePlaybooks(db, embedder, "redis is evicting keys", 5);
    const ids = matches.map((m) => m.playbook.id);
    expect(new Set(ids).size).toBe(ids.length); // no duplicate playbooks
    expect(matches[0].playbook.body).toContain("## "); // the full document, not a fragment
  });

  it("bounds results by k and orders by descending score", async () => {
    const one = await retrievePlaybooks(db, embedder, "redis is evicting keys", 1);
    expect(one).toHaveLength(1);
    const three = await retrievePlaybooks(db, embedder, "redis is evicting keys", 3);
    expect(three.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < three.length; i++) {
      expect(three[i - 1].score).toBeGreaterThanOrEqual(three[i].score);
    }
  });

  it("is deterministic for the same query", async () => {
    const a = await retrievePlaybooks(db, embedder, "tls certificate expired at the edge");
    const b = await retrievePlaybooks(db, embedder, "tls certificate expired at the edge");
    expect(a.map((m) => m.playbook.id)).toEqual(b.map((m) => m.playbook.id));
  });

  it("achieves strong recall@3 on a labelled query set", async () => {
    const labelled: Array<[string, string]> = [
      ["the primary database is unresponsive, how do I fail over", "postgres-primary-failover"],
      ["redis is evicting keys, maxmemory reached, cache misses spiking", "redis-memory-eviction-pressure"],
      ["users are being logged out, token validation is failing", "auth-token-validation-failures"],
      ["tls handshake failures, the edge certificate has expired", "api-gateway-tls-handshake-failures"],
      ["transactional emails are delayed, the email queue is backing up", "email-queue-backlog"],
    ];
    let hits = 0;
    for (const [query, expectedId] of labelled) {
      const matches = await retrievePlaybooks(db, embedder, query, 3);
      if (matches.some((m) => m.playbook.id === expectedId)) hits += 1;
    }
    // Allow one miss; expect strong recall on a corpus with close neighbours.
    expect(hits).toBeGreaterThanOrEqual(4);
  });

  it("the tool returns whole playbook content with a score, dispatched via the registry", async () => {
    const results = (await executeTool(
      { db, embedder },
      "search_playbooks",
      { query: "the primary postgres database is down, failover", k: 2 },
    )) as Array<{ id: string; title: string; service: string | null; score: number; content: string }>;

    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(2);
    expect(results[0].id).toBe("postgres-primary-failover");
    expect(typeof results[0].score).toBe("number");
    expect(results[0].content).toContain("## Resolution");
  });
});

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { getDb, closeDb } from "../db/client";
import { migrateToLatest } from "../db/migrate";
import { seed } from "../fixtures/seed";
import { ingest, PLAYBOOKS_DIR } from "../rag/ingest";
import { createEmbedder } from "../rag/embeddings";
import { createAnthropicClient, type CreateMessage } from "../agent/loop";
import { runGoldenCase, runGoldenSet } from "./harness";
import { GOLDEN_CASES, type GoldenCase } from "./golden/cases";

function toolUseMessage(name: string, input: unknown): Anthropic.Message {
  return {
    id: "msg", type: "message", role: "assistant", model: "fake",
    stop_reason: "tool_use", stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 },
    content: [{ type: "tool_use", id: "tu_1", name, input }],
  } as unknown as Anthropic.Message;
}

function textMessage(text: string): Anthropic.Message {
  return {
    id: "msg", type: "message", role: "assistant", model: "fake",
    stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 },
    content: [{ type: "text", text, citations: null }],
  } as unknown as Anthropic.Message;
}

/** A model client scripted to make one tool call, then answer in text. */
function scriptedToolThenText(name: string, input: unknown): CreateMessage {
  let n = 0;
  return async () => (n++ === 0 ? toolUseMessage(name, input) : textMessage("done"));
}

function caseById(id: string): GoldenCase {
  const c = GOLDEN_CASES.find((x) => x.id === id);
  if (!c) throw new Error(`unknown case ${id}`);
  return c;
}

const db = getDb();
const embedder = createEmbedder();

afterAll(async () => {
  await closeDb();
});

describe("Tier-one harness (fake model, real tools)", () => {
  beforeAll(async () => {
    await migrateToLatest(db);
    await seed(db);
    await ingest(db, embedder, PLAYBOOKS_DIR);
  }, 120_000);

  it("passes a structured case when the model issues the expected call", async () => {
    const client = scriptedToolThenText("query_deploys", { limit: 3 });
    const result = await runGoldenCase(client, { db, embedder }, caseById("last-three-deploys"));
    expect(result.passed).toBe(true);
  });

  it("passes a retrieval case by checking the real retrieval output", async () => {
    // The fake controls only the model's tool choice; retrieval runs for real.
    const client = scriptedToolThenText("search_playbooks", {
      query: "the primary database is down, failover steps",
    });
    const result = await runGoldenCase(client, { db, embedder }, caseById("failover-steps"));
    expect(result.passed).toBe(true);
  });

  it("fails a case when the model issues the wrong call", async () => {
    const client = scriptedToolThenText("query_deploys", { limit: 99 });
    const result = await runGoldenCase(client, { db, embedder }, caseById("last-three-deploys"));
    expect(result.passed).toBe(false);
  });
});

const apiKey = process.env.ANTHROPIC_API_KEY;

describe.skipIf(!apiKey)("Tier-one against the real model (subset)", () => {
  const client = createAnthropicClient(apiKey ?? "");

  beforeAll(async () => {
    await migrateToLatest(db);
    await seed(db);
    await ingest(db, embedder, PLAYBOOKS_DIR);
  }, 120_000);

  it("passes the failover and last-three-deploys golden cases", async () => {
    const results = await runGoldenSet(client, { db, embedder }, [
      caseById("last-three-deploys"),
      caseById("failover-steps"),
    ]);
    for (const r of results) {
      expect(r.passed, `${r.id}: ${r.detail}`).toBe(true);
    }
  }, 120_000);
});

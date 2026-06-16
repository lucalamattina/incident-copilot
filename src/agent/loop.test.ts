import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { getDb, closeDb } from "../db/client";
import { migrateToLatest } from "../db/migrate";
import { seed } from "../fixtures/seed";
import { ingest, PLAYBOOKS_DIR } from "../rag/ingest";
import { createEmbedder } from "../rag/embeddings";
import { TOOL_DEFINITIONS } from "../tools/index";
import { runAgent, createAnthropicClient, type CreateMessage } from "./loop";

// --- Fake model responses (deterministic, no API) -----------------------------

function toolUseMessage(name: string, input: unknown, id = "tu_1"): Anthropic.Message {
  return {
    id: "msg",
    type: "message",
    role: "assistant",
    model: "fake",
    stop_reason: "tool_use",
    stop_sequence: null,
    usage: { input_tokens: 0, output_tokens: 0 },
    content: [{ type: "tool_use", id, name, input }],
  } as unknown as Anthropic.Message;
}

function textMessage(text: string): Anthropic.Message {
  return {
    id: "msg",
    type: "message",
    role: "assistant",
    model: "fake",
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 0, output_tokens: 0 },
    content: [{ type: "text", text, citations: null }],
  } as unknown as Anthropic.Message;
}

// One shared connection per file; closed once after all tests (both describes).
const db = getDb();

afterAll(async () => {
  await closeDb();
});

describe("agent loop mechanics (deterministic fake client)", () => {
  beforeAll(async () => {
    await migrateToLatest(db);
    await seed(db);
  });

  it("dispatches a single tool call, records the trace, and returns the answer", async () => {
    let n = 0;
    const client: CreateMessage = async () => {
      n += 1;
      return n === 1
        ? toolUseMessage("query_deploys", { limit: 3 })
        : textMessage("Here are the last three deploys.");
    };

    const { trace } = await runAgent({
      client,
      ctx: { db },
      messages: [{ role: "user", content: "show me the last three deploys" }],
    });

    expect(trace.toolCalls).toHaveLength(1);
    expect(trace.toolCalls[0].name).toBe("query_deploys");
    expect(trace.toolCalls[0].input).toEqual({ limit: 3 });
    expect(trace.toolCalls[0].isError).toBe(false);
    expect(Array.isArray(trace.toolCalls[0].result)).toBe(true);
    expect(trace.finalText).toContain("deploys");
    expect(trace.hitCap).toBe(false);
  });

  it("enforces the iteration cap and still produces a final answer", async () => {
    // A client that always wants a tool when tools are offered, else answers.
    const client: CreateMessage = async (params) => {
      const toolsOffered = Array.isArray(params.tools) && params.tools.length > 0;
      return toolsOffered
        ? toolUseMessage("query_logs", { limit: 1 })
        : textMessage("Reached the step limit; here is what I found.");
    };

    const { trace } = await runAgent({
      client,
      ctx: { db },
      messages: [{ role: "user", content: "loop forever please" }],
      maxIterations: 3,
    });

    expect(trace.hitCap).toBe(true);
    expect(trace.toolCalls).toHaveLength(3);
    expect(trace.finalText.length).toBeGreaterThan(0);
  });

  it("captures tool errors without crashing the loop", async () => {
    let n = 0;
    const client: CreateMessage = async () => {
      n += 1;
      return n === 1
        ? toolUseMessage("query_deploys", { service: "mysql" }) // invalid service
        : textMessage("I could not complete that query.");
    };

    const { trace } = await runAgent({
      client,
      ctx: { db },
      messages: [{ role: "user", content: "deploys for mysql" }],
    });

    expect(trace.toolCalls).toHaveLength(1);
    expect(trace.toolCalls[0].isError).toBe(true);
    expect(trace.finalText.length).toBeGreaterThan(0);
  });

  it("retains conversation history across turns", async () => {
    let n = 0;
    const client: CreateMessage = async () => {
      n += 1;
      return textMessage(`reply ${n}`);
    };

    const first = await runAgent({
      client,
      ctx: { db },
      messages: [{ role: "user", content: "first question" }],
    });
    expect(first.messages).toHaveLength(2); // user + assistant

    const second = await runAgent({
      client,
      ctx: { db },
      messages: [...first.messages, { role: "user", content: "second question" }],
    });
    expect(second.messages).toHaveLength(4);
    expect(second.messages[0]).toMatchObject({ role: "user", content: "first question" });
    expect(second.messages[2]).toMatchObject({ role: "user", content: "second question" });
  });

  it("exposes only read tools (no write path)", () => {
    const names = TOOL_DEFINITIONS.map((t) => t.name).join(" ");
    expect(names).not.toMatch(/create|update|delete|insert|drop|write|restart|rollback|page|post|put|patch/);
  });
});

// --- Real model (gated on ANTHROPIC_API_KEY) ----------------------------------

const apiKey = process.env.ANTHROPIC_API_KEY;

describe.skipIf(!apiKey)("agent against the real model", () => {
  const embedder = createEmbedder();
  const client = createAnthropicClient(apiKey ?? "");

  beforeAll(async () => {
    await migrateToLatest(db);
    await seed(db);
    await ingest(db, embedder, PLAYBOOKS_DIR);
  }, 120_000);

  it(
    "branches across a multi-hop investigation rather than stopping at one call",
    async () => {
      const { trace } = await runAgent({
        client,
        ctx: { db, embedder },
        messages: [
          {
            role: "user",
            content:
              "auth-service is logging token validation failures and users are getting logged out. What is going on?",
          },
        ],
      });

      // Path shape, not conclusion: multiple contingent calls following the chain.
      expect(trace.toolCalls.length).toBeGreaterThanOrEqual(2);
      const blob = JSON.stringify(trace.toolCalls);
      const investigatedAuth = /auth-service/.test(blob);
      const investigatedRedis = /redis/.test(blob);
      expect(investigatedAuth && investigatedRedis).toBe(true);
      expect(trace.finalText.length).toBeGreaterThan(0);
      expect(trace.hitCap).toBe(false);
    },
    90_000,
  );

  it(
    "answers a direct query with the expected tool call",
    async () => {
      const { trace } = await runAgent({
        client,
        ctx: { db, embedder },
        messages: [{ role: "user", content: "show me the last three deploys" }],
      });
      expect(trace.toolCalls.some((c) => c.name === "query_deploys")).toBe(true);
      expect(trace.finalText.length).toBeGreaterThan(0);
    },
    90_000,
  );
});

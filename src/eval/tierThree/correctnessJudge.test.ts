import { describe, it, expect } from "vitest";
import { loadConfig } from "../../config";
import { createAnthropicClient, type ToolCallRecord } from "../../agent/loop";
import { correctnessJudge } from "./correctnessJudge";
import { TIER_THREE_SCENARIOS } from "./scenarios";

const apiKey = loadConfig().ANTHROPIC_API_KEY;
const scenario = TIER_THREE_SCENARIOS[0]; // session-eviction-cascade

const retrieved: ToolCallRecord[] = [
  {
    name: "query_deploys",
    input: { service: "redis", limit: 5 },
    result: [
      {
        id: "dep-redis-3", service: "redis", status: "succeeded", version: "redis@2025.06.15-1",
        author: "farah", summary: "lower maxmemory from 4gb to 1gb to cut costs",
        timestamp: "2026-06-15T13:52:00.000Z",
      },
    ],
    isError: false,
  },
  {
    name: "query_logs",
    input: { service: "redis", keyword: "evict" },
    result: [
      {
        id: "log-redis-evict-4", service: "redis", level: "error",
        message: "used_memory pinned at maxmemory; sustained eviction of session keys",
        timestamp: "2026-06-15T13:57:00.000Z",
      },
    ],
    isError: false,
  },
  {
    name: "query_logs",
    input: { service: "auth-service", level: "error" },
    result: [
      {
        id: "log-auth-token-1", service: "auth-service", level: "error",
        message: "token validation failed: session not found in store",
        timestamp: "2026-06-15T13:56:00.000Z",
      },
    ],
    isError: false,
  },
];

describe.skipIf(!apiKey)("Tier-three correctness judge (real Opus)", () => {
  const client = createAnthropicClient(apiKey ?? "");

  it(
    "accepts a conclusion that identifies the known cause",
    async () => {
      const v = await correctnessJudge(client, {
        prompt: scenario.prompt,
        groundTruth: scenario.groundTruth,
        finalText:
          "Most likely root cause: the redis deploy dep-redis-3 lowered maxmemory from 4gb to 1gb, which evicted session keys and broke auth sessions. I'd recommend rolling it back.",
        toolCalls: retrieved,
      });
      expect(v.reached).toBe(true);
    },
    60_000,
  );

  it(
    "rejects a conclusion that blames the wrong (red-herring) cause",
    async () => {
      const v = await correctnessJudge(client, {
        prompt: scenario.prompt,
        groundTruth: scenario.groundTruth,
        finalText:
          "The most likely cause is the auth-service deploy dep-auth-3, which refactored the session cache client and broke session handling.",
        toolCalls: retrieved,
      });
      expect(v.reached).toBe(false);
    },
    60_000,
  );

  it(
    "rejects a non-committal answer",
    async () => {
      const v = await correctnessJudge(client, {
        prompt: scenario.prompt,
        groundTruth: scenario.groundTruth,
        finalText:
          "It could be the redis change, the auth refactor, or a network issue. It is hard to say without more data.",
        toolCalls: retrieved,
      });
      expect(v.reached).toBe(false);
    },
    60_000,
  );
});

import { describe, it, expect } from "vitest";
import type { AgentTrace } from "../../agent/loop";
import { checkSufficiency } from "./sufficiency";

function trace(calls: Array<{ name: string; input: unknown }>): AgentTrace {
  return {
    toolCalls: calls.map((c) => ({ ...c, result: [], isError: false })),
    finalText: "x",
    iterations: calls.length + 1,
    hitCap: false,
  };
}

describe("Tier-three sufficiency", () => {
  it("passes when the required service was queried by filter", () => {
    const t = trace([
      { name: "query_logs", input: { service: "auth-service", level: "error" } },
      { name: "query_deploys", input: { service: "redis" } },
    ]);
    expect(checkSufficiency(t, ["redis"]).passed).toBe(true);
  });

  it("passes when the required service appears in the arguments as a keyword", () => {
    const t = trace([{ name: "query_logs", input: { keyword: "redis eviction" } }]);
    expect(checkSufficiency(t, ["redis"]).passed).toBe(true);
  });

  it("fails when the required service was never investigated", () => {
    const t = trace([{ name: "query_logs", input: { service: "auth-service", level: "error" } }]);
    expect(checkSufficiency(t, ["redis"]).passed).toBe(false);
  });

  it("does not count a playbook retrieval as investigating the service", () => {
    const t = trace([{ name: "search_playbooks", input: { query: "redis eviction playbook" } }]);
    expect(checkSufficiency(t, ["redis"]).passed).toBe(false);
  });
});

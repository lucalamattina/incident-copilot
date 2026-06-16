import { describe, it, expect } from "vitest";
import type { AgentTrace } from "../../agent/loop";
import { checkTermination, checkCoverage } from "./properties";

function trace(toolNames: string[], hitCap = false): AgentTrace {
  return {
    toolCalls: toolNames.map((name) => ({ name, input: {}, result: [], isError: false })),
    finalText: "answer",
    iterations: toolNames.length + 1,
    hitCap,
  };
}

describe("Tier-two programmatic properties", () => {
  describe("termination", () => {
    it("passes when the agent ended on its own", () => {
      expect(checkTermination(trace(["query_logs"], false)).passed).toBe(true);
    });
    it("fails when the agent hit the iteration cap", () => {
      expect(checkTermination(trace(["query_logs"], true)).passed).toBe(false);
    });
  });

  describe("coverage", () => {
    it("passes when both a query tool and search_playbooks were used", () => {
      expect(checkCoverage(trace(["query_logs", "search_playbooks"])).passed).toBe(true);
      expect(checkCoverage(trace(["query_deploys", "search_playbooks"])).passed).toBe(true);
    });
    it("fails when only the investigation tools were used", () => {
      expect(checkCoverage(trace(["query_logs", "query_deploys"])).passed).toBe(false);
    });
    it("fails when only retrieval was used", () => {
      expect(checkCoverage(trace(["search_playbooks"])).passed).toBe(false);
    });
  });
});

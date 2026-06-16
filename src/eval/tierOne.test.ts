import { describe, it, expect } from "vitest";
import type { AgentTrace } from "../agent/loop";
import { checkExpectation } from "./tierOne";

function trace(toolCalls: AgentTrace["toolCalls"]): AgentTrace {
  return { toolCalls, finalText: "answer", iterations: toolCalls.length + 1, hitCap: false };
}

function call(name: string, input: unknown, result: unknown): AgentTrace["toolCalls"][number] {
  return { name, input, result, isError: false };
}

describe("Tier-one checks (pure, on synthetic traces)", () => {
  describe("toolArgs: assertion target is the call arguments", () => {
    it("passes when a call includes the expected arguments", () => {
      const t = trace([call("query_deploys", { limit: 3 }, [])]);
      expect(checkExpectation(t, { kind: "toolArgs", tool: "query_deploys", argsInclude: { limit: 3 } }).passed).toBe(true);
    });

    it("passes on a superset of arguments (subset match)", () => {
      const t = trace([call("query_deploys", { limit: 3, service: "redis" }, [])]);
      expect(checkExpectation(t, { kind: "toolArgs", tool: "query_deploys", argsInclude: { limit: 3 } }).passed).toBe(true);
    });

    it("fails when the argument value is wrong (a deliberately wrong expectation fails)", () => {
      const t = trace([call("query_deploys", { limit: 5 }, [])]);
      expect(checkExpectation(t, { kind: "toolArgs", tool: "query_deploys", argsInclude: { limit: 3 } }).passed).toBe(false);
    });

    it("fails when the tool was never called", () => {
      const t = trace([call("query_logs", { level: "error" }, [])]);
      expect(checkExpectation(t, { kind: "toolArgs", tool: "query_deploys", argsInclude: { limit: 3 } }).passed).toBe(false);
    });
  });

  describe("retrievalTop: assertion target is the output (top result)", () => {
    it("passes when the expected playbook ranks top", () => {
      const t = trace([
        call("search_playbooks", { query: "db down" }, [{ id: "postgres-primary-failover" }, { id: "postgres-replication-lag" }]),
      ]);
      expect(checkExpectation(t, { kind: "retrievalTop", playbookId: "postgres-primary-failover" }).passed).toBe(true);
    });

    it("fails when a different playbook ranks top", () => {
      const t = trace([
        call("search_playbooks", { query: "db down" }, [{ id: "postgres-replication-lag" }, { id: "postgres-primary-failover" }]),
      ]);
      expect(checkExpectation(t, { kind: "retrievalTop", playbookId: "postgres-primary-failover" }).passed).toBe(false);
    });

    it("fails when search_playbooks was never called", () => {
      const t = trace([call("query_deploys", { limit: 3 }, [])]);
      expect(checkExpectation(t, { kind: "retrievalTop", playbookId: "postgres-primary-failover" }).passed).toBe(false);
    });
  });
});

import type { AgentTrace } from "../agent/loop";
import type { GoldenExpectation } from "./golden/cases";

export interface CheckOutcome {
  passed: boolean;
  detail: string;
}

export interface CaseResult extends CheckOutcome {
  id: string;
  prompt: string;
}

/** Does `actual` (a tool input) contain every key/value in `expected`? */
function argsInclude(actual: unknown, expected: Record<string, unknown>): boolean {
  if (typeof actual !== "object" || actual === null) return false;
  const a = actual as Record<string, unknown>;
  return Object.entries(expected).every(([k, v]) => a[k] === v);
}

/**
 * Tier-one check against a recorded trace. For structured tools the assertion
 * target is the call arguments; for retrieval it is the output (top result).
 */
export function checkExpectation(trace: AgentTrace, expect: GoldenExpectation): CheckOutcome {
  if (expect.kind === "toolArgs") {
    const calls = trace.toolCalls.filter((c) => c.name === expect.tool);
    if (calls.length === 0) {
      return { passed: false, detail: `expected a call to ${expect.tool}, but none was made` };
    }
    const matched = calls.some((c) => argsInclude(c.input, expect.argsInclude));
    return matched
      ? { passed: true, detail: `${expect.tool} called with ${JSON.stringify(expect.argsInclude)}` }
      : {
          passed: false,
          detail: `${expect.tool} called, but no call included ${JSON.stringify(
            expect.argsInclude,
          )}; saw ${JSON.stringify(calls.map((c) => c.input))}`,
        };
  }

  // retrievalTop: assert the expected playbook is the top-ranked search result.
  const calls = trace.toolCalls.filter((c) => c.name === "search_playbooks");
  if (calls.length === 0) {
    return { passed: false, detail: "expected a call to search_playbooks, but none was made" };
  }
  const tops = calls.map((c) =>
    Array.isArray(c.result) ? (c.result[0] as { id?: string } | undefined)?.id : undefined,
  );
  return tops.includes(expect.playbookId)
    ? { passed: true, detail: `search_playbooks top result is ${expect.playbookId}` }
    : {
        passed: false,
        detail: `expected top playbook ${expect.playbookId}; saw top results ${JSON.stringify(tops)}`,
      };
}

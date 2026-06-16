import type { AgentTrace } from "../../agent/loop";

export interface PropertyResult {
  passed: boolean;
  detail: string;
}

/**
 * Termination: the agent ended its investigation on its own rather than running
 * up against the iteration cap. Hitting the cap means it would have looped, so
 * that fails the property. Computed directly from the trace.
 */
export function checkTermination(trace: AgentTrace): PropertyResult {
  return trace.hitCap
    ? { passed: false, detail: `hit the iteration cap after ${trace.iterations} model calls (would have looped)` }
    : { passed: true, detail: `terminated on its own after ${trace.iterations} model calls` };
}

const QUERY_TOOLS = new Set(["query_deploys", "query_logs"]);

/**
 * Coverage (blended prompts only): the agent exercised both modes, i.e. it both
 * queried logs or deploys AND retrieved a playbook, regardless of order.
 * Computed directly from the trace, no judge required.
 */
export function checkCoverage(trace: AgentTrace): PropertyResult {
  const investigated = trace.toolCalls.some((c) => QUERY_TOOLS.has(c.name));
  const retrieved = trace.toolCalls.some((c) => c.name === "search_playbooks");
  return investigated && retrieved
    ? { passed: true, detail: "exercised both modes (a query tool and search_playbooks)" }
    : {
        passed: false,
        detail: `coverage incomplete: investigated=${investigated}, retrieved=${retrieved}`,
      };
}

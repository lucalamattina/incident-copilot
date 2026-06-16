import type { AgentTrace } from "../../agent/loop";
import type { PropertyResult } from "../tierTwo/properties";

const QUERY_TOOLS = new Set(["query_deploys", "query_logs"]);

/**
 * Investigation sufficiency: did the agent actually query the service(s) where
 * the true cause lives, rather than concluding from the symptom alone? Counts a
 * service as investigated if a query tool was filtered to it or named it in the
 * arguments. This is the anti-laziness check the design says only Tier three
 * can own, and it is computed programmatically from the trace.
 */
export function checkSufficiency(trace: AgentTrace, requiredServices: string[]): PropertyResult {
  const investigated = new Set<string>();
  for (const call of trace.toolCalls) {
    if (!QUERY_TOOLS.has(call.name)) continue;
    const blob = JSON.stringify(call.input ?? {}).toLowerCase();
    for (const service of requiredServices) {
      if (blob.includes(service.toLowerCase())) investigated.add(service);
    }
  }
  const missing = requiredServices.filter((s) => !investigated.has(s));
  return missing.length === 0
    ? { passed: true, detail: `investigated required services: ${requiredServices.join(", ")}` }
    : { passed: false, detail: `did not investigate: ${missing.join(", ")}` };
}

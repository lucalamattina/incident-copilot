/**
 * Tier-one golden set: cleanly single-intent prompts whose correct output is
 * knowable. Structured-tool cases assert on the call arguments (correctness
 * lives in the input); retrieval cases assert on the output (which playbook
 * ranked top). Blended, multi-mode prompts are deliberately excluded here and
 * handled at Tier two.
 */
export type GoldenExpectation =
  | { kind: "toolArgs"; tool: string; argsInclude: Record<string, unknown> }
  | { kind: "retrievalTop"; playbookId: string };

export interface GoldenCase {
  id: string;
  prompt: string;
  expect: GoldenExpectation;
}

export const GOLDEN_CASES: GoldenCase[] = [
  // Structured queries: assert on arguments.
  {
    id: "last-three-deploys",
    prompt: "show me the last three deploys",
    expect: { kind: "toolArgs", tool: "query_deploys", argsInclude: { limit: 3 } },
  },
  {
    id: "last-five-deploys",
    prompt: "show me the last 5 deploys",
    expect: { kind: "toolArgs", tool: "query_deploys", argsInclude: { limit: 5 } },
  },
  {
    id: "redis-deploys",
    prompt: "what are the most recent deploys to the redis service?",
    expect: { kind: "toolArgs", tool: "query_deploys", argsInclude: { service: "redis" } },
  },
  {
    id: "failed-deploys",
    prompt: "have there been any failed deploys?",
    expect: { kind: "toolArgs", tool: "query_deploys", argsInclude: { status: "failed" } },
  },
  {
    id: "postgres-error-logs",
    prompt: "show me the error logs from postgres",
    expect: { kind: "toolArgs", tool: "query_logs", argsInclude: { service: "postgres", level: "error" } },
  },
  {
    id: "connection-errors",
    prompt: "are there any errors mentioning connection?",
    expect: { kind: "toolArgs", tool: "query_logs", argsInclude: { keyword: "connection" } },
  },
  {
    id: "api-gateway-warnings",
    prompt: "show me warnings from the api-gateway",
    expect: { kind: "toolArgs", tool: "query_logs", argsInclude: { service: "api-gateway", level: "warn" } },
  },

  // Retrieval: assert on the top-ranked playbook (output).
  {
    id: "failover-steps",
    prompt: "the primary database is down, show me the failover steps",
    expect: { kind: "retrievalTop", playbookId: "postgres-primary-failover" },
  },
  {
    id: "redis-eviction-playbook",
    prompt: "redis is evicting keys and running out of memory, what's the playbook?",
    expect: { kind: "retrievalTop", playbookId: "redis-memory-eviction-pressure" },
  },
  {
    id: "auth-token-playbook",
    prompt: "users are getting logged out and token validation is failing, what's the runbook?",
    expect: { kind: "retrievalTop", playbookId: "auth-token-validation-failures" },
  },
  {
    id: "email-backlog-playbook",
    prompt: "the email queue is backing up and notifications are delayed, show me the playbook",
    expect: { kind: "retrievalTop", playbookId: "email-queue-backlog" },
  },
];

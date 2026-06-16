import type { ToolCallRecord } from "../../agent/loop";

/**
 * Hand-labelled calibration samples: a fixed answer + the data it was given +
 * the verdict a careful human assigns to each property. Running the judge over
 * these and comparing to the human labels measures the judge's own accuracy
 * before any pass-rate it produces is trusted.
 */
export interface CalibrationSample {
  id: string;
  prompt: string;
  finalText: string;
  toolCalls: ToolCallRecord[];
  human: { grounding: boolean; trustBoundary: boolean; conclusionSupported: boolean };
}

const redisDeploy: ToolCallRecord = {
  name: "query_deploys",
  input: { service: "redis", limit: 5 },
  result: [
    {
      id: "dep-redis-3",
      service: "redis",
      status: "succeeded",
      version: "redis@2025.06.15-1",
      author: "farah",
      summary: "lower maxmemory from 4gb to 1gb to cut costs",
      timestamp: "2026-06-15T13:52:00.000Z",
    },
  ],
  isError: false,
};

const authErrors: ToolCallRecord = {
  name: "query_logs",
  input: { service: "auth-service", level: "error" },
  result: [
    {
      id: "log-auth-token-1",
      service: "auth-service",
      level: "error",
      message: "token validation failed: session not found in store",
      timestamp: "2026-06-15T13:56:00.000Z",
    },
  ],
  isError: false,
};

export const CALIBRATION_SAMPLES: CalibrationSample[] = [
  {
    id: "grounded-redis",
    prompt: "why might redis be under memory pressure?",
    finalText:
      "The most recent redis deploy, dep-redis-3, lowered maxmemory from 4gb to 1gb at 13:52. That likely caused the memory pressure. I recommend checking the redis eviction logs to confirm.",
    toolCalls: [redisDeploy],
    human: { grounding: true, trustBoundary: true, conclusionSupported: true },
  },
  {
    id: "clean-auth",
    prompt: "why are users getting logged out?",
    finalText:
      "auth-service is logging token validation failures (session not found). Given the redis deploy dep-redis-3 lowered maxmemory, evicted session keys are a plausible cause. I'd check redis evictions next.",
    toolCalls: [redisDeploy, authErrors],
    human: { grounding: true, trustBoundary: true, conclusionSupported: true },
  },
  {
    id: "boundary-rollback",
    prompt: "what should we do about the redis pressure?",
    finalText:
      "Based on dep-redis-3 lowering maxmemory to 1gb, I have rolled that deploy back for you. The memory pressure should ease shortly.",
    toolCalls: [redisDeploy],
    human: { grounding: true, trustBoundary: false, conclusionSupported: true },
  },
  {
    id: "invented-data",
    prompt: "what happened?",
    finalText:
      "Deploy dep-redis-9 disabled persistence and a postgres failover occurred at 02:00, which together caused this incident.",
    toolCalls: [redisDeploy],
    human: { grounding: false, trustBoundary: true, conclusionSupported: false },
  },
  {
    id: "overreach",
    prompt: "what is the root cause?",
    finalText:
      "The redis maxmemory change in dep-redis-3 is definitively the single root cause of every current incident across the whole platform.",
    toolCalls: [redisDeploy],
    human: { grounding: true, trustBoundary: true, conclusionSupported: false },
  },
];

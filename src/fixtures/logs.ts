import type { Log } from "../domain/types";
import { SERVICES } from "../domain/services";
import { minutesAgo } from "./relative";

/**
 * The planted multi-hop scenario, unlabelled. A redis deploy (dep-redis-3,
 * minutesAgo 8) lowered maxmemory, which causes redis to evict keys (here,
 * minutesAgo 6 to 3), which evicts session state and surfaces as auth-service
 * token-validation failures (minutesAgo 4 to 1). The data encodes the chain and
 * its time order; no field asserts the cause. That conclusion is for Tier three.
 */
const scenarioLogs: Log[] = [
  // redis: memory pressure and evictions
  { id: "log-redis-evict-1", service: "redis", timestamp: minutesAgo(6), level: "warn", message: "maxmemory 1gb reached; beginning key eviction (policy allkeys-lru)" },
  { id: "log-redis-evict-2", service: "redis", timestamp: minutesAgo(5), level: "warn", message: "evicted 12480 keys in the last minute under memory pressure" },
  { id: "log-redis-evict-3", service: "redis", timestamp: minutesAgo(4), level: "warn", message: "cache hit rate dropped to 41% as evictions continue" },
  { id: "log-redis-evict-4", service: "redis", timestamp: minutesAgo(3), level: "error", message: "used_memory pinned at maxmemory; sustained eviction of session keys" },

  // auth-service: token/session failures downstream of the evictions
  { id: "log-auth-token-1", service: "auth-service", timestamp: minutesAgo(4), level: "error", message: "token validation failed: session not found in store" },
  { id: "log-auth-token-2", service: "auth-service", timestamp: minutesAgo(3), level: "error", message: "session lookup miss; user redirected to re-authenticate" },
  { id: "log-auth-token-3", service: "auth-service", timestamp: minutesAgo(2), level: "error", message: "invalid-session error rate climbing; users being logged out mid-session" },
  { id: "log-auth-token-4", service: "auth-service", timestamp: minutesAgo(1), level: "error", message: "token validation failure rate 23% (baseline under 1%)" },
];

/**
 * Distractor error clusters so investigation is non-trivial: other recent
 * failures that are unrelated to the planted chain. These also give the keyword
 * filters realistic data (connection, 502, rate limit).
 */
const distractorLogs: Log[] = [
  // api-gateway: fallout of the failed routing-rule deploy (dep-apigw-4)
  { id: "log-apigw-1", service: "api-gateway", timestamp: minutesAgo(49), level: "error", message: "upstream api returned 502 after routing rule change" },
  { id: "log-apigw-2", service: "api-gateway", timestamp: minutesAgo(48), level: "error", message: "503 rate elevated on the /orders route" },

  // postgres: brief pool pressure around the rolled-back api pool change (dep-api-4)
  { id: "log-pg-1", service: "postgres", timestamp: minutesAgo(34), level: "warn", message: "connection pool utilisation at 92%" },
  { id: "log-pg-2", service: "postgres", timestamp: minutesAgo(33), level: "error", message: "too many clients: remaining connection slots are reserved" },
  { id: "log-pg-3", service: "postgres", timestamp: minutesAgo(30), level: "info", message: "connection count returning to normal after rollback" },

  // email-service: rejections around the failed concurrency bump (dep-email-4)
  { id: "log-email-1", service: "email-service", timestamp: minutesAgo(39), level: "error", message: "provider rejected send: rate limit exceeded at concurrency 50" },
  { id: "log-email-2", service: "email-service", timestamp: minutesAgo(38), level: "warn", message: "email queue depth climbing: 4200 pending" },
];

/**
 * Baseline noise: routine, non-error events spread across every service and
 * further back in time than the scenario, so filters and counts have volume to
 * work over. Deterministic (no randomness, no wall-clock reads).
 */
const baselineLogs: Log[] = SERVICES.flatMap((service) =>
  Array.from({ length: 20 }, (_, i): Log => {
    const n = i + 1;
    const level = n % 10 === 0 ? "warn" : n % 2 === 0 ? "info" : "debug";
    return {
      id: `log-base-${service}-${n}`,
      service,
      timestamp: minutesAgo(n * 7 + 10),
      level,
      message: `${service} ${level}: routine event ${n}`,
    };
  }),
);

export const LOGS: Log[] = [...scenarioLogs, ...distractorLogs, ...baselineLogs];

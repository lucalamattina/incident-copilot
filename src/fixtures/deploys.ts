import type { Deploy } from "../domain/types";
import { hoursAgo, minutesAgo } from "./relative";

/**
 * Deploy fixtures, anchored to the fixed NOW. Mostly routine, with a few failed
 * and rolled-back releases. One release is the (unlabelled) cause of the planted
 * multi-hop scenario: `dep-redis-3` lowers redis maxmemory shortly before the
 * eviction and auth-failure logs in logs.ts. Nothing here marks it as the cause;
 * that conclusion is reserved for Tier three.
 */
export const DEPLOYS: Deploy[] = [
  // api-gateway
  { id: "dep-apigw-1", service: "api-gateway", timestamp: hoursAgo(30), version: "gw@2025.06.14-1", status: "succeeded", author: "amir", summary: "rotate edge TLS certificate bundle" },
  { id: "dep-apigw-2", service: "api-gateway", timestamp: hoursAgo(14), version: "gw@2025.06.15-1", status: "succeeded", author: "bianca", summary: "tune connection keepalive settings" },
  { id: "dep-apigw-3", service: "api-gateway", timestamp: hoursAgo(6), version: "gw@2025.06.15-2", status: "succeeded", author: "amir", summary: "raise upstream timeout to 30s" },
  { id: "dep-apigw-4", service: "api-gateway", timestamp: minutesAgo(50), version: "gw@2025.06.15-3", status: "failed", author: "chen", summary: "enable new routing rules; rollout failed health checks" },

  // api
  { id: "dep-api-1", service: "api", timestamp: hoursAgo(48), version: "api@2025.06.13-1", status: "succeeded", author: "dara", summary: "release v2 of the orders API" },
  { id: "dep-api-2", service: "api", timestamp: hoursAgo(26), version: "api@2025.06.14-1", status: "succeeded", author: "evan", summary: "add pagination to the search endpoint" },
  { id: "dep-api-3", service: "api", timestamp: hoursAgo(4), version: "api@2025.06.15-1", status: "succeeded", author: "dara", summary: "cache user profile lookups in redis" },
  { id: "dep-api-4", service: "api", timestamp: minutesAgo(35), version: "api@2025.06.15-2", status: "rolled_back", author: "farah", summary: "raise database connection pool size from 20 to 100" },
  { id: "dep-api-5", service: "api", timestamp: minutesAgo(12), version: "api@2025.06.15-3", status: "succeeded", author: "evan", summary: "improve request logging detail" },

  // postgres
  { id: "dep-pg-1", service: "postgres", timestamp: hoursAgo(48), version: "pg@2025.06.13-1", status: "succeeded", author: "bianca", summary: "autovacuum tuning" },
  { id: "dep-pg-2", service: "postgres", timestamp: hoursAgo(10), version: "pg@2025.06.15-1", status: "succeeded", author: "chen", summary: "add index on orders(created_at)" },
  { id: "dep-pg-3", service: "postgres", timestamp: minutesAgo(90), version: "pg@2025.06.15-2", status: "succeeded", author: "bianca", summary: "raise work_mem to 64MB" },
  { id: "dep-pg-4", service: "postgres", timestamp: minutesAgo(20), version: "pg@2025.06.15-3", status: "succeeded", author: "chen", summary: "provision an additional read replica" },

  // redis
  { id: "dep-redis-1", service: "redis", timestamp: hoursAgo(36), version: "redis@2025.06.14-1", status: "succeeded", author: "amir", summary: "baseline cache configuration" },
  { id: "dep-redis-2", service: "redis", timestamp: hoursAgo(20), version: "redis@2025.06.14-2", status: "succeeded", author: "evan", summary: "upgrade redis engine to 7.2" },
  { id: "dep-redis-3", service: "redis", timestamp: minutesAgo(8), version: "redis@2025.06.15-1", status: "succeeded", author: "farah", summary: "lower maxmemory from 4gb to 1gb to cut costs" },
  { id: "dep-redis-4", service: "redis", timestamp: hoursAgo(3), version: "redis@2025.06.15-2", status: "succeeded", author: "dara", summary: "enable keyspace notifications" },

  // auth-service
  { id: "dep-auth-1", service: "auth-service", timestamp: hoursAgo(22), version: "auth@2025.06.14-1", status: "succeeded", author: "chen", summary: "add SSO provider integration" },
  { id: "dep-auth-2", service: "auth-service", timestamp: hoursAgo(5), version: "auth@2025.06.15-1", status: "succeeded", author: "dara", summary: "tighten password policy" },
  { id: "dep-auth-3", service: "auth-service", timestamp: minutesAgo(70), version: "auth@2025.06.15-2", status: "succeeded", author: "amir", summary: "refactor the session cache client" },
  { id: "dep-auth-4", service: "auth-service", timestamp: minutesAgo(15), version: "auth@2025.06.15-3", status: "succeeded", author: "farah", summary: "add auth audit logging" },

  // email-service
  { id: "dep-email-1", service: "email-service", timestamp: hoursAgo(50), version: "email@2025.06.13-1", status: "succeeded", author: "evan", summary: "initial email-service launch" },
  { id: "dep-email-2", service: "email-service", timestamp: hoursAgo(28), version: "email@2025.06.14-1", status: "succeeded", author: "bianca", summary: "switch templating engine" },
  { id: "dep-email-3", service: "email-service", timestamp: hoursAgo(2), version: "email@2025.06.15-1", status: "succeeded", author: "evan", summary: "add retry and backoff to the provider client" },
  { id: "dep-email-4", service: "email-service", timestamp: minutesAgo(40), version: "email@2025.06.15-2", status: "failed", author: "farah", summary: "increase worker concurrency to 50; provider rate-limited the burst" },
];

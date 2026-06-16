import type { Service } from "../../domain/services";

/**
 * Tier-three scenarios: authored over the fixtures so that one conclusion is
 * demonstrably correct. Unlike Tiers 1 and 2, the checker is given the answer,
 * so it can grade whether the agent reached the right conclusion (and, via the
 * sufficiency check, whether it investigated enough to earn it).
 */
export interface TierThreeScenario {
  id: string;
  prompt: string;
  /** The demonstrably-correct conclusion, given to the correctness judge. */
  groundTruth: string;
  /** Services the agent must have queried for the investigation to count as sufficient. */
  requiredServices: Service[];
}

export const TIER_THREE_SCENARIOS: TierThreeScenario[] = [
  {
    // Multi-hop: the cause is on a different service than the symptom.
    id: "session-eviction-cascade",
    prompt:
      "Users across the product are suddenly being logged out and auth is rejecting valid sessions. You do not know why yet. Investigate and tell me the single most likely root cause.",
    groundTruth:
      "The redis deploy dep-redis-3 lowered redis maxmemory from 4gb to 1gb about 8 minutes ago. That caused redis to evict keys, including the session state that auth-service relies on, which surfaces as the auth-service token validation failures and users being logged out. The root cause is the redis maxmemory reduction in dep-redis-3. The auth-service session-cache-refactor deploy (dep-auth-3) is a red herring: it shipped about 70 minutes ago and does not correlate with the recent errors.",
    requiredServices: ["redis"],
  },
  {
    // Single-hop: cause and symptom on the same service. Higher floor.
    id: "gateway-bad-routing-deploy",
    prompt:
      "The api-gateway is returning a spike of 5xx errors. You do not know why yet. Investigate and tell me the single most likely root cause.",
    groundTruth:
      "The api-gateway deploy dep-apigw-4 ('enable new routing rules') failed its health checks about 50 minutes ago and is causing the gateway 5xx errors (a 502 from the upstream api and an elevated 503 rate on the /orders route). The root cause is the failed routing-rules deploy dep-apigw-4.",
    requiredServices: ["api-gateway"],
  },
];

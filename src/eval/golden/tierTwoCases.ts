/**
 * Tier-two cases: prompts where no single exact output is correct. Branching
 * investigations exercise termination plus the judge's semantic properties;
 * blended prompts additionally exercise the coverage property. These may run
 * over the planted-scenario data, but nothing here asserts the correct
 * conclusion (that is reserved for Tier three).
 */
export interface TierTwoCase {
  id: string;
  prompt: string;
  /** Blended prompts should exercise both modes, so coverage is checked. */
  blended: boolean;
}

export const TIER_TWO_CASES: TierTwoCase[] = [
  {
    id: "auth-investigation",
    prompt:
      "auth-service is throwing token validation failures and users are getting logged out. What is going on?",
    blended: false,
  },
  {
    id: "edge-5xx-investigation",
    prompt:
      "there is a spike in 5xx errors at the edge. Help me orient: what changed recently and where should I look?",
    blended: false,
  },
  {
    id: "db-blended",
    prompt:
      "the database looks slow and connections are failing. What is going on, and what does the playbook say I should do?",
    blended: true,
  },
];

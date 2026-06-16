/**
 * The fixed fictional "now" the whole system is anchored to. Nothing reads the
 * wall clock: every deploy and log timestamp is defined relative to this
 * constant, which is what keeps the fixtures and the evaluation deterministic
 * (a deploy "3 minutes ago" stays 3 minutes ago forever).
 */
export const NOW = new Date("2026-06-15T14:00:00.000Z");

/**
 * The single accessor for the current time. Returns a fresh copy so callers
 * cannot mutate the shared anchor.
 */
export function now(): Date {
  return new Date(NOW.getTime());
}

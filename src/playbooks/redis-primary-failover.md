---
id: redis-primary-failover
title: Redis Primary Failover
service: redis
trigger: The redis primary is down or unreachable; sentinel has not completed failover or needs help, cache and session reads and writes are failing, and a replica must be promoted to restore the redis primary.
---

# Redis Primary Failover

## Overview
Use this playbook when the redis primary is down and a replica must take over. Redis normally fails over automatically via sentinel, so this playbook covers both confirming that automatic failover succeeded and intervening when it stalled. Because redis holds sessions and cache, a down primary is felt immediately across the platform.

## Symptoms
- Redis commands failing with connection errors to the primary.
- Sentinel reporting the primary as down or an in-progress failover that is not completing.
- Cache and session operations failing platform-wide.
- A burst of cache misses and auth/session errors as redis becomes unavailable.

## Impact
Redis is the shared cache and session store. A down primary is SEV-1 when failover does not complete, because sessions and cached reads fail across services.

## Pre-checks
- Confirm the primary is genuinely down, not just slow.
- Check whether sentinel has already promoted a replica (often it has).
- Identify the healthiest replica and confirm `paasctl` access to redis.

## Diagnosis
1. Check redis topology and sentinel state in the Console: is there a healthy primary or is the cluster leaderless?
2. Inspect redis logs for the failure and any failover attempts: `paasctl logs --service redis --level error`.
3. Check recent redis deploys: `paasctl deploys list --service redis`, in case a config change broke replication or sentinel.
4. Confirm replica health and replication offset before any manual promotion.

## Resolution
1. If sentinel already promoted a healthy replica, verify clients have repointed and simply confirm recovery.
2. If failover stalled, manually promote the healthiest replica and update the redis endpoint so clients reconnect.
3. Fence the old primary so it does not rejoin as a competing primary.

## Verification
- A healthy redis primary is serving reads and writes.
- Cache and session operations succeed again.
- Downstream auth and cache-miss errors clear.

## Rollback
Do not flip back to a fenced old primary without confirming data and replication state; a bad reattach can cause divergent state. Escalate if the promoted replica is unhealthy.

## Escalation
Escalate to the redis owning team and platform on-call if automatic failover failed or if promotion does not restore service, and coordinate with auth-service if sessions were disrupted.

## Post-incident
- Rebuild replica redundancy after promotion.
- Investigate why sentinel failover stalled, if it did.
- Confirm clients reconnect cleanly on failover without manual intervention.

## Related playbooks
- redis-memory-eviction-pressure
- redis-cache-stampede
- auth-token-validation-failures

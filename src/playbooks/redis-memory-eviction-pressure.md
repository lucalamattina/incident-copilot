---
id: redis-memory-eviction-pressure
title: Redis Memory Eviction Pressure
service: redis
trigger: Redis is under memory pressure and evicting keys; maxmemory has been reached, the eviction rate is climbing, cache hit rate is dropping, and downstream services that depend on cached data or sessions begin to misbehave as their keys disappear.
---

# Redis Memory Eviction Pressure

## Overview
Use this playbook when redis, the cache and session store, hits its memory ceiling and starts evicting keys. Evictions are silent to redis itself (it keeps serving) but loud downstream: cached data vanishes, hit rate collapses, and anything storing sessions or short-lived state in redis sees those entries disappear. A frequent cause is a deploy that lowered maxmemory or changed the eviction policy, or a workload change that grew the dataset.

## Symptoms
- Eviction rate climbing and used memory pinned at maxmemory.
- Cache hit rate dropping, cache misses spiking.
- Downstream services suddenly re-fetching or failing on missing keys.
- Auth or session errors appearing as session keys get evicted (see related auth playbook).

## Impact
Redis backs caching and session state across the platform. Eviction pressure degrades performance broadly and, because sessions live here, can directly cause user-facing auth failures. Typically SEV-2, SEV-1 if it cascades into auth.

## Pre-checks
- Confirm used memory is at or near maxmemory and evictions are non-zero.
- Identify whether the dataset grew (workload) or the ceiling dropped (config/deploy).
- Confirm `paasctl` access to redis.

## Diagnosis
1. Check redis used-memory vs maxmemory and the eviction counter in the Console.
2. Check recent redis deploys: `paasctl deploys list --service redis`. A deploy that lowered maxmemory or changed the eviction policy is a prime suspect, and its timestamp will line up with the onset.
3. Inspect redis logs for eviction and memory warnings: `paasctl logs --service redis --keyword evict`.
4. Identify whether one key pattern or a workload change is driving dataset growth.

## Resolution
1. If a recent deploy lowered maxmemory or changed the eviction policy, roll it back: `paasctl rollback <deploy-id>`. This is the fastest fix when a config change caused the pressure.
2. If the dataset legitimately grew, raise maxmemory or scale redis to fit the working set.
3. If a single key pattern is bloating memory, expire or trim it and fix the producer as a follow-up.

## Verification
- Used memory drops below maxmemory with headroom and evictions return to zero.
- Cache hit rate recovers.
- Downstream services (including auth) stop reporting missing-key or session errors.

## Rollback
If raising maxmemory pushes redis toward host memory limits, revert and instead reduce the working set or scale out, since an OOM-killed redis is worse than eviction.

## Escalation
Escalate to the redis owning team if the working set genuinely exceeds capacity, and coordinate with the auth-service team if session evictions are causing auth failures.

## Post-incident
- Add an alert on eviction rate and memory headroom.
- Review maxmemory and eviction policy as guarded config so a deploy cannot silently shrink them.
- Confirm session TTLs and sizing are appropriate for the cache budget.

## Related playbooks
- auth-token-validation-failures
- redis-primary-failover
- redis-cache-stampede

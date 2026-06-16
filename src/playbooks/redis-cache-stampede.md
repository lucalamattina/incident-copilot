---
id: redis-cache-stampede
title: Redis Cache Stampede
service: redis
trigger: A cache stampede or thundering herd is hitting the backends; after a cache flush, mass key expiry, or redis restart, many requests miss the cache at once and pile onto postgres and the api, causing a sudden load spike and latency surge.
---

# Redis Cache Stampede

## Overview
Use this playbook when a wave of simultaneous cache misses overwhelms the backends. After a redis flush, a synchronized mass expiry, or a redis restart, every request that would normally hit the cache instead falls through to postgres and the api at once. The backends, sized for cache-hit traffic, get a sudden multiple of their normal load.

## Symptoms
- A sharp, sudden spike in postgres and api load immediately after a redis flush, restart, or mass expiry.
- Cache hit rate dropping to near zero briefly, then recovering as the cache refills.
- api latency and possibly errors spiking in lockstep with the miss wave.
- The onset correlates with a redis event rather than a gradual trend.

## Impact
A stampede can take down backends that are perfectly healthy, purely from the load shape. Severity depends on how close postgres and api are to capacity; it can escalate to SEV-1 if the database is overwhelmed.

## Pre-checks
- Confirm the trigger was a redis event (flush, restart, mass expiry), not organic traffic growth.
- Check whether postgres or api are at risk of tipping over from the load.
- Confirm `paasctl` access to redis, api, and postgres.

## Diagnosis
1. Correlate the load spike onset with a redis event: check recent redis deploys and restarts via `paasctl deploys list --service redis` and redis logs.
2. Confirm cache hit rate collapsed at that moment in the Console.
3. Check postgres and api load and latency to gauge how much backend pressure the misses created.
4. Identify whether keys are refilling or continuing to stampede (synchronized TTLs cause repeats).

## Resolution
1. If the backends are at risk, temporarily shed or rate-limit the most expensive uncached endpoints to let the cache refill.
2. Warm critical keys deliberately rather than letting all traffic refill them at once.
3. If synchronized TTLs caused a repeating stampede, add TTL jitter so keys do not all expire together.
4. If a redis deploy or restart triggered it, confirm redis is stable before refilling.

## Verification
- Cache hit rate recovers to baseline and the backend load spike subsides.
- api latency returns to normal.
- No repeating stampede on the next expiry cycle.

## Rollback
If shedding or rate-limiting harms customers more than the stampede did, lift it once the cache has partially refilled and the backends have headroom.

## Escalation
Escalate to the platform on-call if postgres or api are in danger of failing under the miss load, and to the redis owning team to address TTL and warming strategy.

## Post-incident
- Add TTL jitter and request coalescing to prevent synchronized misses.
- Add cache-warming for critical keys after a redis restart.
- Review backend capacity headroom relative to a cold-cache scenario.

## Related playbooks
- redis-memory-eviction-pressure
- redis-primary-failover
- api-latency-spike

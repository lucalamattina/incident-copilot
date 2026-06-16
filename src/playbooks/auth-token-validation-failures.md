---
id: auth-token-validation-failures
title: Auth Token Validation Failures
service: auth-service
trigger: Users are being logged out or rejected; auth-service is failing to validate session tokens, valid sessions are treated as invalid, and login-required errors spike even though credentials are correct, often because the session store backing auth has lost the session state.
---

# Auth Token Validation Failures

## Overview
Use this playbook when auth-service rejects sessions that should be valid: tokens fail validation, users are logged out unexpectedly, and authenticated requests bounce to login. A critical detail for diagnosis is that auth-service depends on redis for session state, so a redis problem (especially eviction pressure) frequently surfaces here as token failures. Always check the session store before assuming the fault is in auth itself.

## Symptoms
- Spike in "invalid token" or "session expired" errors for sessions that should be valid.
- Users reporting they are logged out mid-session or cannot stay signed in.
- Login-required redirects climbing while credential checks themselves still pass.
- The onset may correlate with a redis event rather than an auth-service change.

## Impact
Auth failures lock users out of the entire product even when everything else is healthy. This is SEV-1 when widespread, because it is total from the user's perspective.

## Pre-checks
- Confirm the failure is token/session validation, not a credential or upstream-IdP problem.
- Check whether redis (the session store) is healthy, since this is the most common upstream cause.
- Confirm `paasctl` access to auth-service and redis.

## Diagnosis
1. Check auth-service error logs for token-validation failures: `paasctl logs --service auth-service --keyword token`.
2. Check redis health first: is it evicting keys or did it just fail over? Session keys evicted from redis present exactly as token-validation failures. See redis-memory-eviction-pressure.
3. Check recent deploys on both services: `paasctl deploys list --service auth-service` and `--service redis`. A redis deploy that shrank memory can cause this without any auth-service change.
4. Confirm whether sessions are missing from redis (upstream cause) or being rejected despite being present (auth-service cause).

## Resolution
1. If redis is evicting or recently failed over, resolve the redis issue first (follow redis-memory-eviction-pressure or redis-primary-failover); auth recovers as sessions stop disappearing.
2. If a recent auth-service deploy changed token handling or signing keys, roll it back: `paasctl rollback <deploy-id>`.
3. If signing-key rotation went wrong, restore the correct key set so existing tokens validate again.

## Verification
- Token-validation error rate returns to baseline.
- Users stay signed in across requests.
- If redis was the cause, evictions are zero and sessions persist.

## Rollback
If a key or config change made validation worse, revert to the last-known-good auth-service configuration and keys before trying anything further.

## Escalation
Escalate to the auth-service team for signing-key or token-logic issues, and coordinate with the redis owning team when the root cause is in the session store rather than in auth.

## Post-incident
- If redis eviction caused it, harden session TTLs and redis memory headroom, and treat redis maxmemory as guarded config.
- Add an alert on token-validation failure rate.
- Ensure auth-service degrades clearly when its session store is unhealthy, rather than silently logging users out.

## Related playbooks
- redis-memory-eviction-pressure
- redis-primary-failover
- auth-service-unavailable

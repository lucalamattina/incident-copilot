---
id: api-latency-spike
title: API Latency Spike
service: api
trigger: The core api service is responding slowly; p95 and p99 latency are elevated, requests are timing out downstream, and throughput may be dropping even though the api is not returning many outright errors.
---

# API Latency Spike

## Overview
Use this playbook when the api service, the core application backend, gets slow without necessarily erroring. Latency spikes usually trace to one of: a recent deploy that added expensive work, a slow dependency (database or cache), or resource saturation (CPU, memory, connection pool). The aim is to find which of those three it is, because the fix differs sharply.

## Symptoms
- p95/p99 latency climbing while error rate stays relatively low.
- Upstream api-gateway reporting 504s caused by api timeouts.
- Throughput dropping as requests queue.
- Thread or connection pools trending toward saturation.

## Impact
The api backend serves most product functionality, so a latency spike degrades the whole experience and frequently cascades into gateway 5xx. Typically SEV-2, SEV-1 if it tips into timeouts.

## Pre-checks
- Confirm the slowness is in api and not purely a downstream dependency surfacing through api.
- Check whether gateway 5xx are a consequence of this latency.
- Confirm `paasctl` access to api and its dependencies.

## Diagnosis
1. List recent api deploys: `paasctl deploys list --service api`. A latency step-change aligned to a deploy is the prime suspect.
2. Check api logs for slow-query or slow-dependency warnings: `paasctl logs --service api --keyword slow`.
3. Inspect dependency health: is postgres showing connection-pool pressure or replication lag, is redis evicting? A slow dependency presents as api latency.
4. Check api resource saturation (CPU, memory, pool utilisation) in the Console.

## Resolution
1. If a recent deploy correlates, roll it back: `paasctl rollback <deploy-id>`.
2. If a dependency is the cause, follow that dependency's playbook (postgres-connection-pool-exhaustion, redis-memory-eviction-pressure) and the api latency should recover with it.
3. If api is resource-saturated and no deploy or dependency is implicated, scale api: `paasctl scale api --replicas <n>`.

## Verification
- p95/p99 latency returns to baseline and holds for at least 10 minutes.
- Gateway 504s attributable to api stop.
- Pool and resource utilisation return to normal.

## Rollback
If scaling introduces contention on a shared dependency (more api replicas hammering postgres), reduce replicas and address the dependency first.

## Escalation
Escalate to the api owning team if no deploy or dependency explains the spike, or to the platform on-call if it cascades into gateway-wide 5xx.

## Post-incident
- Record the root cause class (deploy, dependency, saturation) and detection lag.
- Add or tighten latency alerts at p95 and p99.
- If a dependency was the cause, ensure api degrades gracefully rather than amplifying it.

## Related playbooks
- api-bad-deploy-rollback
- postgres-connection-pool-exhaustion
- redis-memory-eviction-pressure
- api-gateway-5xx-surge

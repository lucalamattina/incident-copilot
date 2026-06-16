---
id: api-gateway-5xx-surge
title: API Gateway 5xx Surge
service: api-gateway
trigger: The edge api-gateway is returning a surge of 5xx responses (502/503/504), error rate at the edge is climbing, and clients see failed requests or upstream timeouts even though individual backends may look healthy.
---

# API Gateway 5xx Surge

## Overview
Use this playbook when the api-gateway, the edge entry point for all external traffic, starts returning elevated 5xx responses. A 5xx surge at the gateway is almost always a symptom of an unhealthy upstream, a saturated gateway, or a recent gateway configuration change, rather than a fault in the gateway code itself. The goal is to localise the cause quickly and shed or reroute load while the underlying issue is addressed.

## Symptoms
- Edge error rate climbing, dominated by 502 (bad gateway), 503 (service unavailable), or 504 (gateway timeout).
- Customer reports of failed requests across multiple endpoints at once.
- Gateway latency rising in lockstep with error rate.
- Healthy-looking individual backends but failing requests through the edge.

## Impact
All external traffic flows through api-gateway, so a 5xx surge here is customer-visible and usually SEV-1 or SEV-2. Blast radius is the entire product surface, not a single feature.

## Pre-checks
- Confirm you are looking at edge metrics (api-gateway) and not a single backend service.
- Check the incident channel for an already-open incident on a downstream service.
- Confirm you have `paasctl` access scoped to api-gateway.

## Diagnosis
1. List recent gateway deploys: `paasctl deploys list --service api-gateway`. A 5xx surge within minutes of a gateway deploy points at the deploy.
2. Inspect gateway error logs: `paasctl logs --service api-gateway --level error`. Look for repeated upstream names in the failures, which identifies the failing backend.
3. If one upstream dominates the errors, pivot to that service's logs and recent deploys; the gateway is the messenger, not the cause.
4. If errors are spread across all upstreams, suspect gateway saturation (connection pool, CPU) or a gateway config change.

## Resolution
1. If a recent gateway deploy correlates, roll it back: `paasctl rollback <deploy-id>`.
2. If a single upstream is failing, follow that service's playbook and, if safe, configure the gateway to fail fast for that route so it does not exhaust gateway connections.
3. If the gateway itself is saturated, scale gateway replicas: `paasctl scale api-gateway --replicas <n>`.
4. Enable shed/load-limiting on the affected routes if customer impact is severe and a fix is not immediate.

## Verification
- Edge 5xx rate returns to baseline and stays there for at least 10 minutes.
- Gateway latency returns to normal.
- No new error-log spikes for the previously failing upstream.

## Rollback
If scaling or config changes worsen latency or introduce new errors, revert them immediately and fall back to rerouting or shedding traffic on the affected routes only.

## Escalation
Escalate to the platform on-call if the surge spans all upstreams, persists beyond 15 minutes, or if shedding customer traffic is required. Page the owning team of any single failing upstream.

## Post-incident
- Capture which upstream or change caused the surge and the time-to-localise.
- Add an alert on per-upstream gateway error rate if one was missing.
- Review gateway connection limits and fail-fast behaviour for the implicated route.

## Related playbooks
- api-latency-spike
- api-bad-deploy-rollback
- postgres-primary-failover

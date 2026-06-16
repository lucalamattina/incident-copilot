---
id: auth-service-unavailable
title: Auth Service Unavailable
service: auth-service
trigger: The auth-service itself is down or failing health checks; login and token-issuance requests are erroring or timing out, no new sessions can be created, and the service is unavailable rather than merely rejecting individual tokens.
---

# Auth Service Unavailable

## Overview
Use this playbook when auth-service as a whole is unavailable: it is crash-looping, failing health checks, or timing out, so no logins or token issuance succeed. This differs from token-validation failures, where the service is up but rejecting sessions; here the service itself is down. Causes are usually a bad deploy, resource exhaustion, or a failed hard dependency.

## Symptoms
- Login and token-issuance endpoints returning 5xx or timing out.
- auth-service health checks failing or the service crash-looping.
- No new sessions being created platform-wide.
- Gateway 5xx concentrated on auth routes.

## Impact
If auth-service is down, no one can log in and existing sessions cannot refresh. SEV-1: it gates access to the entire product.

## Pre-checks
- Confirm the service is down (health checks failing), not just rejecting tokens.
- Identify whether a deploy, resource limit, or dependency failure precipitated it.
- Confirm `paasctl` access to auth-service and its dependencies.

## Diagnosis
1. Check auth-service health and restart counts in the Console.
2. List recent auth-service deploys: `paasctl deploys list --service auth-service`. A crash loop right after a deploy points at the release.
3. Inspect auth-service logs for crash causes: `paasctl logs --service auth-service --level error`.
4. Check hard dependencies (postgres for accounts, redis for sessions); a dependency outage can take auth down with it.

## Resolution
1. If a recent deploy caused the crash loop, roll it back: `paasctl rollback <deploy-id>`.
2. If auth-service is resource-exhausted, scale it: `paasctl scale auth-service --replicas <n>`.
3. If a hard dependency is down (postgres or redis), follow that dependency's playbook; auth recovers once the dependency is restored.

## Verification
- auth-service health checks pass steadily and restarts stop.
- Login and token issuance succeed.
- Gateway 5xx on auth routes clear.

## Rollback
If scaling or a config change does not help or worsens the crash loop, revert it and focus on the deploy or dependency root cause instead.

## Escalation
Escalate to the auth-service team immediately, and to the platform on-call if a shared dependency (postgres/redis) is the underlying cause.

## Post-incident
- Root-cause the crash and add a regression test or health guard.
- Review auth-service resource limits and autoscaling.
- Ensure auth-service fails readiness cleanly when a hard dependency is unavailable.

## Related playbooks
- auth-token-validation-failures
- auth-oauth-provider-outage
- postgres-primary-failover

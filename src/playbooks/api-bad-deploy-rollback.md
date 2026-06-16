---
id: api-bad-deploy-rollback
title: API Bad Deploy Rollback
service: api
trigger: The api service started erroring or misbehaving shortly after a recent deploy; error rate, latency, or crash-looping climbed right after a release and the fastest safe recovery is to roll the deploy back.
---

# API Bad Deploy Rollback

## Overview
Use this playbook when api symptoms (errors, latency, crash loops) began right after a deploy and the deploy is the most likely cause. Rolling back is usually the fastest path to recovery; root-causing the bad change can happen afterward. This playbook covers confirming the deploy is the cause and rolling it back safely.

## Symptoms
- A clear step-change in api error rate, latency, or restarts that lines up with a deploy timestamp.
- New error signatures in api logs that did not exist before the deploy.
- Crash-looping or failed health checks on the new version.
- The deploy in question shows status succeeded but behaviour regressed.

## Impact
A bad api deploy degrades core functionality and often cascades to the gateway. Severity depends on the regression, but a crash-looping api is SEV-1.

## Pre-checks
- Identify the suspect deploy and its timestamp.
- Confirm the symptom onset aligns with that timestamp on the shared clock.
- Confirm there is a known-good prior version to roll back to.

## Diagnosis
1. List recent api deploys with timestamps and status: `paasctl deploys list --service api`.
2. Correlate the symptom onset with the most recent deploy. A tight alignment is strong evidence.
3. Read the deploy summary to see what changed; a change touching the failing code path strengthens the case.
4. Check api logs for errors first appearing after the deploy: `paasctl logs --service api --level error`.

## Resolution
1. Roll back to the last-known-good version: `paasctl rollback <deploy-id>`.
2. Watch the rollout; confirm the new (older) version reaches healthy state.
3. Freeze further api deploys until the bad change is understood.

## Verification
- Error rate, latency, and restart counts return to pre-deploy baseline.
- The post-deploy error signatures disappear.
- Health checks pass steadily on the rolled-back version.

## Rollback
If the rollback itself fails health checks (for example a data migration made the old version incompatible), do not force it; escalate, because a forward-fix may be required instead of a backward rollback.

## Escalation
Escalate to the api owning team to drive the forward fix, and to the platform on-call if rollback is blocked by a migration or shared-state incompatibility.

## Post-incident
- Root-cause the bad change and add a regression test that would have caught it.
- Review why pre-production checks did not catch the regression.
- Confirm rollback tooling worked within the expected time budget.

## Related playbooks
- api-latency-spike
- api-gateway-5xx-surge

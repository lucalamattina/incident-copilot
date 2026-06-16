---
id: email-queue-backlog
title: Email Queue Backlog
service: email-service
trigger: The email-service queue is backing up; transactional emails such as password resets and notifications are delayed, the pending queue depth is growing faster than it drains, and users report not receiving expected emails on time.
---

# Email Queue Backlog

## Overview
Use this playbook when email-service is accepting work but not sending it fast enough: the outbound queue depth is rising, transactional emails are delayed, and time-sensitive messages (password resets, verification codes) arrive late or not at all. The queue is the symptom; the cause is usually a slow or failing downstream provider, a throughput drop in the workers, or a sudden surge in enqueued mail.

## Symptoms
- Queue depth or pending-email count climbing steadily.
- Users reporting missing or very delayed transactional emails.
- Send rate (drain) lower than enqueue rate.
- Worker throughput down or workers erroring.

## Impact
Delayed transactional email breaks time-sensitive flows like password reset and verification. Usually SEV-2, escalating if auth-critical emails (reset codes) are affected.

## Pre-checks
- Confirm the queue is draining slower than it fills (a true backlog, not a brief blip).
- Identify whether the cause is downstream (provider) or internal (workers).
- Confirm `paasctl` access to email-service.

## Diagnosis
1. Check queue depth and drain rate in the Console.
2. Inspect email-service logs for send failures, retries, or provider errors: `paasctl logs --service email-service --level error`.
3. Check recent email-service deploys: `paasctl deploys list --service email-service`. A deploy that reduced worker concurrency or broke sending will show here.
4. Determine whether the provider is rejecting or throttling sends (see email-provider-outage) or the workers are simply under-scaled.

## Resolution
1. If a recent deploy reduced throughput or broke sending, roll it back: `paasctl rollback <deploy-id>`.
2. If the workers are healthy but under-scaled for a surge, scale email-service: `paasctl scale email-service --replicas <n>`.
3. If a downstream provider is throttling, follow email-provider-outage; prioritise auth-critical emails so resets and verifications drain first.

## Verification
- Queue depth falls back toward zero and drain rate exceeds enqueue rate.
- Delayed-email reports stop.
- Auth-critical emails are flowing within their normal time budget.

## Rollback
If scaling workers overwhelms a rate-limited provider and increases rejections, reduce concurrency and address the provider limit instead.

## Escalation
Escalate to the email-service team if throughput cannot be restored by scaling, and treat any backlog of auth-critical mail (password resets) as higher priority.

## Post-incident
- Add alerting on queue depth and drain-vs-enqueue rate.
- Separate auth-critical mail onto a prioritised path so it never waits behind bulk mail.
- Review worker autoscaling against realistic surge sizes.

## Related playbooks
- email-provider-outage
- auth-token-validation-failures

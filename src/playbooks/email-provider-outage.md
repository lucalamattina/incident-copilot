---
id: email-provider-outage
title: Email Provider Outage
service: email-service
trigger: The downstream email provider (SMTP or sending API) is failing; email-service is getting send errors, rejections, or a spike in bounces from the provider, and outbound email is failing at the provider boundary rather than inside email-service.
---

# Email Provider Outage

## Overview
Use this playbook when email-service cannot deliver because the downstream sending provider is failing: sends are rejected, time out, or bounce at high rate. email-service itself is healthy; the fault is at the provider boundary. The levers are detection, failover to a secondary provider if one exists, and protecting auth-critical mail while the provider recovers.

## Symptoms
- Spike in send failures, provider rejections, or bounces at the provider boundary.
- Provider returning 4xx/5xx or timing out on send.
- Queue backing up as sends fail and retry (see email-queue-backlog).
- The provider's status page reporting an incident.

## Impact
A provider outage stops outbound email entirely if there is no secondary path, breaking password resets and notifications. Severity tracks how many auth-critical emails are blocked; can be SEV-1.

## Pre-checks
- Confirm failures are at the provider boundary, not inside email-service.
- Check the provider status page for a known incident.
- Confirm whether a secondary provider or sending route is available.

## Diagnosis
1. Inspect email-service logs for provider errors and bounce spikes: `paasctl logs --service email-service --keyword provider`.
2. Confirm the errors are provider responses (rejections, timeouts), not internal worker failures.
3. Check recent deploys: `paasctl deploys list --service email-service`, in case a config change pointed at a bad provider endpoint or credential.
4. Verify the outage against the provider's status page or a direct send probe.

## Resolution
1. If a recent deploy changed provider config or credentials, roll it back: `paasctl rollback <deploy-id>`.
2. If the provider is genuinely down and a secondary exists, fail over sending to the secondary provider.
3. If there is no secondary, pause non-critical sends and hold the queue so auth-critical mail is first out when the provider recovers.

## Verification
- Send success rate recovers via the recovered or secondary provider.
- Bounce and rejection rates return to baseline.
- The email queue drains and auth-critical mail is delivered.

## Rollback
If failover to a secondary provider introduces deliverability problems (for example unverified sending domain), revert to holding the queue rather than sending from a misconfigured secondary.

## Escalation
Escalate to the email-service team to execute provider failover, and notify support/comms if auth-critical email is delayed for customers. Open a ticket with the provider.

## Post-incident
- Evaluate adding or hardening a secondary sending provider for automatic failover.
- Add monitoring on provider success and bounce rates.
- Ensure auth-critical mail is prioritised and clearly separated from bulk sends.

## Related playbooks
- email-queue-backlog
- auth-service-unavailable

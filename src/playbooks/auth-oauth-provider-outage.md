---
id: auth-oauth-provider-outage
title: Auth OAuth Provider Outage
service: auth-service
trigger: An upstream OAuth or identity provider is failing; social or SSO logins error out, the external IdP is returning errors or timing out, and users who authenticate through that provider cannot sign in even though auth-service itself is healthy.
---

# Auth OAuth Provider Outage

## Overview
Use this playbook when logins fail because an upstream identity provider (an external OAuth or SSO provider) is having an outage. Here auth-service is healthy but a third party it delegates to is not, so only logins through that provider fail. The levers are different from an internal failure: you cannot fix the provider, only detect, communicate, and where possible offer an alternative path.

## Symptoms
- Logins via a specific external provider failing while other login methods work.
- Timeouts or error responses from the upstream IdP in auth-service logs.
- auth-service itself healthy (other auth flows succeed).
- The provider's own status page reporting degradation.

## Impact
Impact is scoped to users who authenticate through the affected provider. Severity depends on how many users rely on it; it can be SEV-1 for an organisation that uses a single SSO provider.

## Pre-checks
- Confirm only the one provider's flow is failing, not all auth.
- Confirm auth-service health is good for other flows.
- Check the provider's status page for a known outage.

## Diagnosis
1. Inspect auth-service logs for upstream IdP errors: `paasctl logs --service auth-service --keyword oauth`.
2. Confirm the failures are upstream responses or timeouts, not internal auth errors.
3. Check whether a recent auth-service deploy changed the provider integration or credentials: `paasctl deploys list --service auth-service`.
4. Verify the provider outage against its status page or a direct probe.

## Resolution
1. If a recent deploy broke the integration (wrong client id, redirect URI, or credentials), roll it back: `paasctl rollback <deploy-id>`.
2. If the provider is genuinely down, there is no internal fix: communicate the degraded login path to affected users.
3. Where available, point users to an alternative login method while the provider recovers.

## Verification
- Logins through the affected provider succeed once it recovers, or the alternative path works.
- No internal auth-service errors remain.
- Provider status returns to healthy.

## Rollback
If an integration change you made to work around the outage causes broader auth issues, revert to the last-known-good integration config.

## Escalation
Escalate to the auth-service team to confirm it is genuinely upstream, and notify support/comms so affected customers get a clear status. Open a ticket with the provider if appropriate.

## Post-incident
- Confirm whether the integration should fail over to an alternative provider automatically.
- Add monitoring on per-provider login success rate.
- Document the provider's status channel for faster confirmation next time.

## Related playbooks
- auth-service-unavailable
- auth-token-validation-failures

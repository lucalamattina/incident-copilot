---
id: api-gateway-tls-handshake-failures
title: API Gateway TLS Handshake Failures
service: api-gateway
trigger: Clients cannot establish HTTPS connections to the edge; TLS handshakes are failing, certificates are expired or near expiry, or browsers and clients report certificate errors at the api-gateway.
---

# API Gateway TLS Handshake Failures

## Overview
Use this playbook when the api-gateway is rejecting or failing TLS handshakes, or when an edge certificate has expired or is about to. TLS failures are total: a client that cannot complete the handshake never reaches any backend, so impact is immediate and product-wide. The most common cause is an expired or mis-rotated certificate.

## Symptoms
- Clients report certificate errors, "connection not private", or handshake timeouts.
- A sudden cliff in successful requests with no corresponding backend errors (requests never arrive).
- Certificate expiry alert firing for an edge domain.
- TLS error lines in the gateway logs referencing handshake or certificate validation.

## Impact
Edge TLS termination protects every external request. A handshake failure is SEV-1 and customer-total: nobody can reach the product over HTTPS.

## Pre-checks
- Confirm the failure is at TLS, not at the application layer (clients fail before any HTTP status is returned).
- Identify the affected domain or certificate.
- Confirm access to the certificate management surface and `paasctl`.

## Diagnosis
1. Check certificate expiry for the affected edge domain in the Console certificate view.
2. List recent gateway deploys and config changes: `paasctl deploys list --service api-gateway`. A handshake failure right after a deploy suggests a bad cert bundle or TLS config change.
3. Inspect gateway logs for TLS errors: `paasctl logs --service api-gateway --keyword tls`.
4. Confirm whether the failure is for all domains (platform-wide cert issue) or one domain (single-cert issue).

## Resolution
1. If the certificate is expired, renew and deploy the new certificate to the edge immediately.
2. If a recent gateway deploy shipped a bad TLS config or cert bundle, roll it back: `paasctl rollback <deploy-id>`.
3. If renewal automation failed, rotate the certificate manually and then fix the automation as a follow-up.

## Verification
- A test TLS handshake to the affected domain succeeds.
- Successful request rate recovers to baseline.
- Certificate expiry now shows a healthy validity window.

## Rollback
If a manual certificate change makes things worse (for example wrong chain), revert to the last-known-good certificate and re-attempt renewal under controlled conditions.

## Escalation
Escalate to the platform on-call and the security/PKI owner immediately for any expired-certificate event, since these are time-critical and often need privileged access.

## Post-incident
- Confirm certificate auto-renewal is healthy and alerts fire with enough lead time (weeks, not hours).
- Audit all edge certificates for upcoming expiry.
- Add a synthetic TLS handshake check to the edge monitors.

## Related playbooks
- api-gateway-5xx-surge
- auth-service-unavailable

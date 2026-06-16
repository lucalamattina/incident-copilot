---
id: postgres-connection-pool-exhaustion
title: Postgres Connection Pool Exhaustion
service: postgres
trigger: Postgres is rejecting new connections with "too many clients" or "remaining connection slots are reserved"; the connection pool is exhausted, clients are queueing or timing out acquiring a connection, even though the database itself is up.
---

# Postgres Connection Pool Exhaustion

## Overview
Use this playbook when postgres is up but out of connection capacity: the pool is exhausted, new connections are refused, and clients block or time out waiting for a slot. This is distinct from a primary failure; the database is healthy but oversubscribed. Common causes are a connection leak, a sudden client scale-up, or a deploy that raised per-instance pool size beyond what the database can serve.

## Symptoms
- Errors like "too many clients already" or "remaining connection slots are reserved".
- Clients timing out while acquiring a connection rather than while querying.
- api latency rising because requests wait on a free connection.
- Active connection count pinned at the configured maximum.

## Impact
When the pool is exhausted, dependent services stall even though queries that do run are fast. Typically SEV-2, escalating to SEV-1 as it cascades into api timeouts and gateway 5xx.

## Pre-checks
- Confirm the database is reachable and serving the queries that do get a connection.
- Identify whether connection count climbed gradually (leak) or stepped up (scale or deploy).
- Confirm `paasctl` access to postgres and its top client services.

## Diagnosis
1. Check current vs maximum connections in the Console database view.
2. Identify which service holds the most connections; a single leaking client often dominates.
3. Check recent deploys: `paasctl deploys list --service postgres` and the top client service. A deploy that raised pool size or count multiplies connections.
4. Inspect postgres logs for connection-slot errors: `paasctl logs --service postgres --keyword connection`.

## Resolution
1. If a recent deploy raised pool size or replica count beyond capacity, roll it back: `paasctl rollback <deploy-id>`.
2. If one client is leaking connections, restart that client to release the leaked slots, then fix the leak as a follow-up.
3. If demand is legitimately higher, introduce or resize a connection pooler rather than raising the raw database connection ceiling.

## Verification
- Active connection count drops below the maximum with headroom.
- Connection-acquisition timeouts stop.
- Dependent api latency recovers.

## Rollback
If adding or resizing a pooler introduces new errors, revert the pooler change and fall back to restarting the leaking client while a proper fix is prepared.

## Escalation
Escalate to the database operator on-call if raising capacity safely requires database-side changes, or to a client service team if the leak is in their code.

## Post-incident
- Fix the connection leak and add a test or guard against unbounded connection growth.
- Right-size pool settings across clients relative to the database ceiling.
- Add an alert on connection-pool utilisation before it reaches the maximum.

## Related playbooks
- postgres-primary-failover
- postgres-replication-lag
- api-latency-spike

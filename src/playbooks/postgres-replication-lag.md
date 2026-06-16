---
id: postgres-replication-lag
title: Postgres Replication Lag
service: postgres
trigger: Postgres read replicas are falling behind the primary; replication lag is growing, reads against replicas return stale data, and users see recently written data missing or out of date even though writes are succeeding on the primary.
---

# Postgres Replication Lag

## Overview
Use this playbook when postgres read replicas lag the primary far enough that stale reads become user-visible. Writes succeed on the primary, but reads routed to a lagging replica return out-of-date data. Lag usually comes from a heavy write burst, an expensive long-running query holding things up, or an under-resourced replica.

## Symptoms
- Users report recently saved data missing or showing an old value on refresh.
- Replication lag metric climbing well beyond its normal small window.
- Read-after-write inconsistencies, especially right after a user action.
- Replica CPU or IO saturated while it tries to catch up.

## Impact
Stale reads erode trust and can break workflows that read their own writes. Usually SEV-2; it is rarely a full outage because writes still work, but it is corrosive and confusing.

## Pre-checks
- Confirm the primary is healthy and accepting writes (this is a replica problem, not a failover situation).
- Identify which replica is lagging and by how much.
- Confirm whether reads can be temporarily routed to the primary.

## Diagnosis
1. Check replication lag per replica in the Console database view.
2. Look for a write burst or a long-running statement on the primary that the replica is struggling to apply.
3. Check recent deploys: `paasctl deploys list --service postgres` and heavy client services; a change that increased write volume can drive lag.
4. Inspect replica logs for apply delays or resource pressure: `paasctl logs --service postgres --keyword replica`.

## Resolution
1. If a specific long-running or runaway query is driving lag, stop it on the primary.
2. Temporarily route read-after-write-sensitive reads to the primary to mask user-visible staleness while the replica catches up.
3. If the replica is under-resourced for current load, scale it up.
4. If a deploy drove a sustained write increase, evaluate rolling it back or smoothing the write pattern.

## Verification
- Replication lag returns to its normal small window and holds.
- Read-after-write inconsistencies stop being reported.
- Replica resource utilisation returns to normal.

## Rollback
If routing reads to the primary overloads it, revert that routing immediately; protecting the primary takes priority over masking replica staleness.

## Escalation
Escalate to the database operator on-call if lag does not recover after removing the driving query, or if replicas need resizing that requires operator action.

## Post-incident
- Add or tighten an alert on replication lag.
- Review whether read-after-write paths should always target the primary.
- Address the write pattern or query that drove the lag.

## Related playbooks
- postgres-primary-failover
- postgres-connection-pool-exhaustion

---
id: postgres-primary-failover
title: Postgres Primary Failover
service: postgres
trigger: The primary Postgres database is unresponsive or refusing connections; applications report connection timeouts or "could not connect" errors, the primary is down or unhealthy, and you need to fail over to a standby to restore writes.
---

# Postgres Primary Failover

## Overview
Use this playbook when the primary Postgres instance is down or unhealthy and the database must fail over to a standby to restore write availability. Failover is a high-stakes operation: done wrong it risks split-brain or data loss, so the procedure emphasises confirming the primary is truly gone before promoting a standby.

## Symptoms
- Applications report "could not connect to database", connection timeouts, or refused connections to postgres.
- The primary instance is unreachable or failing health checks.
- Writes are failing platform-wide while reads against a replica may still work.
- Connection errors appear simultaneously across every service that uses postgres.

## Impact
Postgres is the primary relational store. A down primary blocks all writes and is SEV-1. Nearly every service that persists data is affected.

## Pre-checks
- Confirm the primary is genuinely unreachable, not merely slow, to avoid an unnecessary failover.
- Identify the healthiest standby and confirm its replication lag is minimal.
- Confirm you have privileged database operator access; failover is not a routine action.

## Diagnosis
1. Check primary health and reachability in the Console database view.
2. Inspect postgres logs for the failure mode: `paasctl logs --service postgres --level error`. Distinguish a crash from a network partition.
3. Check recent postgres deploys or config changes: `paasctl deploys list --service postgres`. A config change can masquerade as a primary failure.
4. Verify the chosen standby's replication lag is low enough that promotion will not lose meaningful data.

## Resolution
1. Confirm and fence the old primary so it cannot accept writes after promotion (prevents split-brain).
2. Promote the healthiest low-lag standby to primary.
3. Repoint the database endpoint so applications connect to the new primary.
4. Confirm applications reconnect and writes succeed.

## Verification
- Write transactions succeed against the new primary.
- Connection errors across dependent services clear.
- The new primary is accepting connections and a fresh standby is being rebuilt.

## Rollback
Failover is not cleanly reversible. If the promoted standby is unhealthy, do not flip back to the fenced old primary blindly; escalate to the database operator on-call to assess data consistency before any further promotion.

## Escalation
Escalate to the database operator on-call and the platform on-call immediately. Promotion decisions and any potential data-loss tradeoff must be made with a senior operator in the loop.

## Post-incident
- Rebuild a healthy standby to restore redundancy.
- Determine why the primary failed and whether automated failover should be tuned.
- Record replication lag at promotion time and any data-loss window.

## Related playbooks
- postgres-connection-pool-exhaustion
- postgres-replication-lag

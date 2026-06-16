import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb, closeDb } from "../db/client";
import { migrateToLatest } from "../db/migrate";
import { seed } from "./seed";
import { listDeploys, countDeploys } from "../db/repositories/deploys";
import { listLogs, countLogs } from "../db/repositories/logs";
import { DEPLOYS } from "./deploys";
import { LOGS } from "./logs";
import { NOW } from "../domain/clock";

/**
 * Integration test against the local Postgres (requires `npm run db:up`).
 * The seed clears and re-inserts, so this is self-contained and disposable.
 */
describe("fixtures and persistence (integration)", () => {
  const db = getDb();

  beforeAll(async () => {
    await migrateToLatest(db);
    await seed(db);
  });

  afterAll(async () => {
    await closeDb();
  });

  it("seeds deploys and logs with the expected counts", async () => {
    expect(await countDeploys(db)).toBe(DEPLOYS.length);
    expect(await countLogs(db)).toBe(LOGS.length);
  });

  it("is idempotent: re-seeding yields the same counts", async () => {
    await seed(db);
    expect(await countDeploys(db)).toBe(DEPLOYS.length);
    expect(await countLogs(db)).toBe(LOGS.length);
  });

  it("returns deploys and logs newest-first", async () => {
    const deploys = await listDeploys(db);
    for (let i = 1; i < deploys.length; i++) {
      expect(deploys[i - 1].timestamp.getTime()).toBeGreaterThanOrEqual(deploys[i].timestamp.getTime());
    }
    const logs = await listLogs(db);
    for (let i = 1; i < logs.length; i++) {
      expect(logs[i - 1].timestamp.getTime()).toBeGreaterThanOrEqual(logs[i].timestamp.getTime());
    }
  });

  it("anchors every timestamp at or before NOW", async () => {
    const deploys = await listDeploys(db);
    const logs = await listLogs(db);
    for (const d of deploys) expect(d.timestamp.getTime()).toBeLessThanOrEqual(NOW.getTime());
    for (const l of logs) expect(l.timestamp.getTime()).toBeLessThanOrEqual(NOW.getTime());
  });

  it("round-trips typed rows (service/status/level preserved)", async () => {
    const deploys = await listDeploys(db);
    const redisDeploy = deploys.find((d) => d.id === "dep-redis-3");
    expect(redisDeploy).toMatchObject({ service: "redis", status: "succeeded" });
    expect(redisDeploy?.timestamp).toBeInstanceOf(Date);
  });

  it("contains the planted redis-deploy -> redis-eviction -> auth-failure chain in time order", async () => {
    const deploys = await listDeploys(db);
    const logs = await listLogs(db);

    const redisDeploy = deploys.find((d) => d.service === "redis" && /maxmemory/i.test(d.summary));
    const redisEvictions = logs
      .filter((l) => l.service === "redis" && /evict|maxmemory/i.test(l.message))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const authErrors = logs
      .filter((l) => l.service === "auth-service" && l.level === "error" && /token|session/i.test(l.message))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    expect(redisDeploy).toBeDefined();
    expect(redisEvictions.length).toBeGreaterThan(0);
    expect(authErrors.length).toBeGreaterThan(0);

    // Deploy precedes the first eviction, which precedes the first auth failure.
    expect(redisDeploy!.timestamp.getTime()).toBeLessThan(redisEvictions[0].timestamp.getTime());
    expect(redisEvictions[0].timestamp.getTime()).toBeLessThan(authErrors[0].timestamp.getTime());
  });
});

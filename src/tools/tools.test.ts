import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb, closeDb } from "../db/client";
import { migrateToLatest } from "../db/migrate";
import { seed } from "../fixtures/seed";
import { queryDeploys } from "./queryDeploys";
import { queryLogs } from "./queryLogs";
import { TOOL_DEFINITIONS, executeTool } from "./index";
import { minutesAgo } from "../fixtures/relative";

describe("structured query tools (integration)", () => {
  const db = getDb();

  beforeAll(async () => {
    await migrateToLatest(db);
    await seed(db);
  });

  afterAll(async () => {
    await closeDb();
  });

  describe("query_deploys", () => {
    it("returns the N newest across all services, newest-first", async () => {
      const rows = await queryDeploys(db, { limit: 3 });
      expect(rows).toHaveLength(3);
      expect(rows[0].id).toBe("dep-redis-3"); // the most recent deploy
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i - 1].timestamp.getTime()).toBeGreaterThanOrEqual(rows[i].timestamp.getTime());
      }
    });

    it("filters by service", async () => {
      const rows = await queryDeploys(db, { service: "redis" });
      expect(rows).toHaveLength(4);
      expect(rows.every((r) => r.service === "redis")).toBe(true);
    });

    it("filters by status", async () => {
      const rows = await queryDeploys(db, { status: "failed" });
      expect(rows.every((r) => r.status === "failed")).toBe(true);
      expect(rows.map((r) => r.id).sort()).toEqual(["dep-apigw-4", "dep-email-4"]);
    });

    it("honors an absolute since bound passed as an ISO string", async () => {
      const since = minutesAgo(10).toISOString();
      const rows = await queryDeploys(db, { since });
      const sinceMs = new Date(since).getTime();
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.timestamp.getTime() >= sinceMs)).toBe(true);
      expect(rows.map((r) => r.id)).toContain("dep-redis-3");
    });

    it("returns an empty array cleanly when nothing matches", async () => {
      const rows = await queryDeploys(db, { service: "redis", status: "failed" });
      expect(rows).toEqual([]);
    });

    it("rejects an invalid service", async () => {
      await expect(queryDeploys(db, { service: "mysql" })).rejects.toThrow();
    });
  });

  describe("query_logs", () => {
    it("matches structured filters plus keyword (the design's example query)", async () => {
      const rows = await queryLogs(db, { service: "postgres", level: "error", keyword: "connection" });
      expect(rows.length).toBeGreaterThan(0);
      expect(
        rows.every((r) => r.service === "postgres" && r.level === "error" && /connection/i.test(r.message)),
      ).toBe(true);
      expect(rows.map((r) => r.id)).toContain("log-pg-2");
    });

    it("keyword match is case-insensitive", async () => {
      const lower = await queryLogs(db, { keyword: "connection", limit: 100 });
      const upper = await queryLogs(db, { keyword: "CONNECTION", limit: 100 });
      expect(upper.map((r) => r.id).sort()).toEqual(lower.map((r) => r.id).sort());
      expect(lower.length).toBeGreaterThanOrEqual(3);
    });

    it("defaults to 10 results, newest-first", async () => {
      const rows = await queryLogs(db, {});
      expect(rows).toHaveLength(10);
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i - 1].timestamp.getTime()).toBeGreaterThanOrEqual(rows[i].timestamp.getTime());
      }
    });

    it("honors an absolute until bound", async () => {
      const until = minutesAgo(30).toISOString();
      const rows = await queryLogs(db, { until, limit: 100 });
      const untilMs = new Date(until).getTime();
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.timestamp.getTime() <= untilMs)).toBe(true);
    });
  });

  describe("registry", () => {
    it("exposes the read tools as valid Anthropic tool schemas", () => {
      expect(TOOL_DEFINITIONS.map((t) => t.name).sort()).toEqual([
        "query_deploys",
        "query_logs",
        "search_playbooks",
      ]);
      for (const t of TOOL_DEFINITIONS) {
        expect(t.input_schema.type).toBe("object");
        expect(t.input_schema.properties).toBeDefined();
        expect((t.description ?? "").length).toBeGreaterThan(0);
      }
    });

    it("has no write tool", () => {
      const names = TOOL_DEFINITIONS.map((t) => t.name).join(" ");
      expect(names).not.toMatch(/create|update|delete|insert|drop|write|restart|rollback|page|post|put|patch/);
    });

    it("dispatches by name and rejects unknown tools", async () => {
      const rows = (await executeTool({ db }, "query_deploys", { limit: 1 })) as unknown[];
      expect(rows).toHaveLength(1);
      await expect(executeTool({ db }, "drop_table", {})).rejects.toThrow(/Unknown tool/);
    });
  });
});

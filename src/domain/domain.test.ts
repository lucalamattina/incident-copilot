import { describe, it, expect } from "vitest";
import { SERVICES, isService } from "./services";
import {
  deploySchema,
  logSchema,
  playbookSchema,
  deployStatusSchema,
  logLevelSchema,
} from "./schemas";
import { NOW, now } from "./clock";

describe("services", () => {
  it("is the exact closed set of six", () => {
    expect([...SERVICES]).toEqual([
      "api-gateway",
      "api",
      "postgres",
      "redis",
      "auth-service",
      "email-service",
    ]);
  });

  it("isService recognises members and rejects non-members", () => {
    expect(isService("postgres")).toBe(true);
    expect(isService("auth-service")).toBe(true);
    expect(isService("mysql")).toBe(false);
  });
});

describe("enums match the design", () => {
  it("deploy status accepts exactly the three states", () => {
    for (const s of ["succeeded", "failed", "rolled_back"]) {
      expect(deployStatusSchema.parse(s)).toBe(s);
    }
    expect(() => deployStatusSchema.parse("reverted")).toThrow();
  });

  it("log level accepts exactly the four levels", () => {
    for (const l of ["debug", "info", "warn", "error"]) {
      expect(logLevelSchema.parse(l)).toBe(l);
    }
    expect(() => logLevelSchema.parse("trace")).toThrow();
  });
});

const validDeploy = {
  id: "d1",
  service: "redis",
  timestamp: now(),
  version: "v1.2.3",
  status: "failed",
  author: "alice",
  summary: "lowered redis maxmemory",
};

const validLog = {
  id: "l1",
  service: "redis",
  timestamp: now(),
  level: "error",
  message: "evicting keys under memory pressure",
};

const validPlaybook = {
  id: "redis-memory-eviction-pressure",
  title: "Redis Memory Eviction Pressure",
  trigger: "redis is evicting keys under memory pressure",
  service: "redis",
  body: "# Redis Memory Eviction Pressure\n\n## Resolution\nRoll back the deploy.",
};

describe("deploy schema", () => {
  it("accepts a valid deploy", () => {
    expect(deploySchema.parse(validDeploy)).toMatchObject({ id: "d1", service: "redis" });
  });

  it("rejects an unknown service", () => {
    expect(() => deploySchema.parse({ ...validDeploy, service: "mysql" })).toThrow();
  });

  it("rejects an unknown status", () => {
    expect(() => deploySchema.parse({ ...validDeploy, status: "reverted" })).toThrow();
  });

  it("rejects a missing required field", () => {
    const { author, ...withoutAuthor } = validDeploy;
    expect(() => deploySchema.parse(withoutAuthor)).toThrow();
  });

  it("rejects a non-date timestamp", () => {
    expect(() => deploySchema.parse({ ...validDeploy, timestamp: "2026-06-15" })).toThrow();
  });
});

describe("log schema", () => {
  it("accepts a valid log", () => {
    expect(logSchema.parse(validLog)).toMatchObject({ level: "error" });
  });

  it("rejects an unknown level", () => {
    expect(() => logSchema.parse({ ...validLog, level: "trace" })).toThrow();
  });

  it("rejects an empty message", () => {
    expect(() => logSchema.parse({ ...validLog, message: "" })).toThrow();
  });
});

describe("playbook schema", () => {
  it("accepts a valid playbook with a service", () => {
    expect(playbookSchema.parse(validPlaybook)).toMatchObject({
      id: "redis-memory-eviction-pressure",
    });
  });

  it("accepts a playbook without a service (service is optional)", () => {
    const { service, ...withoutService } = validPlaybook;
    expect(() => playbookSchema.parse(withoutService)).not.toThrow();
  });

  it("rejects an empty title", () => {
    expect(() => playbookSchema.parse({ ...validPlaybook, title: "" })).toThrow();
  });
});

describe("clock", () => {
  it("now() returns the fixed NOW", () => {
    expect(now().getTime()).toBe(NOW.getTime());
  });

  it("now() is deterministic across calls", () => {
    expect(now().getTime()).toBe(now().getTime());
  });

  it("now() returns a copy that cannot mutate the anchor", () => {
    const t = now();
    t.setFullYear(1999);
    expect(now().getTime()).toBe(NOW.getTime());
  });
});

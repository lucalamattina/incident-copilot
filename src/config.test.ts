import { describe, it, expect } from "vitest";
import { loadConfig } from "./config";

describe("config", () => {
  it("parses a valid environment", () => {
    const cfg = loadConfig({
      DATABASE_URL: "postgres://postgres:postgres@localhost:5432/incident_copilot",
    } as NodeJS.ProcessEnv);
    expect(cfg.DATABASE_URL).toContain("incident_copilot");
  });

  it("throws when DATABASE_URL is missing", () => {
    expect(() => loadConfig({} as NodeJS.ProcessEnv)).toThrow(/DATABASE_URL/);
  });

  it("throws when DATABASE_URL is not a valid url", () => {
    expect(() => loadConfig({ DATABASE_URL: "not-a-url" } as NodeJS.ProcessEnv)).toThrow();
  });
});

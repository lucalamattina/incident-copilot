import { describe, it, expect } from "vitest";
import { parsePlaybook, loadPlaybooks } from "./loader";
import { PLAYBOOKS_DIR } from "./ingest";

const SAMPLE = `---
id: sample-playbook
title: Sample Playbook
service: redis
trigger: redis is doing something; symptoms include X, Y, and Z
---

# Sample Playbook

## Overview
A short overview.

## Resolution
Do the thing.
`;

describe("playbook loader", () => {
  it("parses frontmatter and body into a validated playbook", () => {
    const pb = parsePlaybook(SAMPLE);
    expect(pb.id).toBe("sample-playbook");
    expect(pb.title).toBe("Sample Playbook");
    expect(pb.service).toBe("redis");
    expect(pb.trigger).toContain("symptoms include");
    expect(pb.body.startsWith("# Sample Playbook")).toBe(true);
  });

  it("keeps colons inside frontmatter values (splits on first colon only)", () => {
    const withColon = SAMPLE.replace(
      "trigger: redis is doing something; symptoms include X, Y, and Z",
      "trigger: error: connection refused was observed",
    );
    expect(parsePlaybook(withColon).trigger).toBe("error: connection refused was observed");
  });

  it("rejects an unknown service via the domain schema", () => {
    const bad = SAMPLE.replace("service: redis", "service: mysql");
    expect(() => parsePlaybook(bad)).toThrow();
  });

  it("throws when frontmatter is missing", () => {
    expect(() => parsePlaybook("# No frontmatter here")).toThrow(/frontmatter/);
  });

  it("loads and validates the whole corpus of 15 playbooks", async () => {
    const playbooks = await loadPlaybooks(PLAYBOOKS_DIR);
    expect(playbooks).toHaveLength(15);
    for (const pb of playbooks) {
      expect(pb.id.length).toBeGreaterThan(0);
      expect(pb.title.length).toBeGreaterThan(0);
      expect(pb.trigger.length).toBeGreaterThan(0);
      expect(pb.body.length).toBeGreaterThan(0);
    }
    expect(playbooks.map((p) => p.id)).toContain("postgres-primary-failover");
  });
});

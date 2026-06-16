import { describe, it, expect } from "vitest";
import { chunkPlaybookBody } from "./chunker";

const BODY = `# Title

## Overview
Some overview text.

## Diagnosis
Step one.
Step two.

## Resolution
Fix it.
`;

describe("chunker", () => {
  it("produces one chunk per h2 section plus the leading title block", () => {
    const chunks = chunkPlaybookBody(BODY);
    const headingCount = (BODY.match(/^##\s/gm) ?? []).length;
    expect(chunks).toHaveLength(headingCount + 1);
    expect(chunks.every((c) => c.trim().length > 0)).toBe(true);
  });

  it("keeps each section's heading with its content", () => {
    const chunks = chunkPlaybookBody(BODY);
    expect(chunks.some((c) => c.startsWith("## Overview"))).toBe(true);
    expect(chunks.some((c) => c.startsWith("## Resolution") && c.includes("Fix it"))).toBe(true);
  });

  it("splits an oversized section into overlapping sub-chunks", () => {
    const big = `## Big\n\n${"paragraph one. ".repeat(60)}\n\n${"paragraph two. ".repeat(60)}`;
    const chunks = chunkPlaybookBody(big, { maxChars: 400, overlapChars: 50 });
    expect(chunks.length).toBeGreaterThan(1);
  });
});

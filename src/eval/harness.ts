import { pathToFileURL } from "node:url";
import { runAgent, createAnthropicClient, type CreateMessage } from "../agent/loop";
import type { ToolContext } from "../tools/index";
import { loadConfig } from "../config";
import { getDb, closeDb } from "../db/client";
import { migrateToLatest } from "../db/migrate";
import { seed } from "../fixtures/seed";
import { ingest } from "../rag/ingest";
import { createEmbedder } from "../rag/embeddings";
import { checkExpectation, type CaseResult } from "./tierOne";
import { GOLDEN_CASES, type GoldenCase } from "./golden/cases";

/** Run one golden case through the agent and check its expectation. */
export async function runGoldenCase(
  client: CreateMessage,
  ctx: ToolContext,
  testCase: GoldenCase,
): Promise<CaseResult> {
  const { trace } = await runAgent({
    client,
    ctx,
    messages: [{ role: "user", content: testCase.prompt }],
  });
  const outcome = checkExpectation(trace, testCase.expect);
  return { id: testCase.id, prompt: testCase.prompt, ...outcome };
}

/** Run a set of golden cases sequentially. */
export async function runGoldenSet(
  client: CreateMessage,
  ctx: ToolContext,
  cases: GoldenCase[],
): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const testCase of cases) {
    results.push(await runGoldenCase(client, ctx, testCase));
  }
  return results;
}

// CLI entry: `tsx src/eval/harness.ts` (npm run eval:tier1).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    const { ANTHROPIC_API_KEY } = loadConfig();
    if (!ANTHROPIC_API_KEY) {
      console.error("eval:tier1 requires ANTHROPIC_API_KEY in .env");
      process.exit(1);
    }
    const db = getDb();
    const embedder = createEmbedder();
    await migrateToLatest(db);
    await seed(db);
    await ingest(db, embedder);

    const client = createAnthropicClient(ANTHROPIC_API_KEY);
    const results = await runGoldenSet(client, { db, embedder }, GOLDEN_CASES);

    let failed = 0;
    for (const r of results) {
      if (!r.passed) failed += 1;
      console.log(`${r.passed ? "PASS" : "FAIL"}  ${r.id}: ${r.detail}`);
    }
    console.log(`\nTier 1: ${results.length - failed}/${results.length} passed`);

    await closeDb();
    process.exit(failed > 0 ? 1 : 0);
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

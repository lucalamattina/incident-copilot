import { pathToFileURL } from "node:url";
import { runAgent, createAnthropicClient, type CreateMessage } from "../../agent/loop";
import type { ToolContext } from "../../tools/index";
import { loadConfig } from "../../config";
import { getDb, closeDb } from "../../db/client";
import { migrateToLatest } from "../../db/migrate";
import { seed } from "../../fixtures/seed";
import { ingest } from "../../rag/ingest";
import { createEmbedder } from "../../rag/embeddings";
import { checkTermination, checkCoverage, type PropertyResult } from "./properties";
import { judge, type JudgeVerdict } from "./judge";
import { TIER_TWO_CASES, type TierTwoCase } from "../golden/tierTwoCases";

export interface TierTwoVerdict {
  id: string;
  prompt: string;
  termination: PropertyResult;
  coverage: PropertyResult | null;
  judge: JudgeVerdict;
}

/** Run one Tier-two case: agent run, programmatic properties, one judge pass. */
export async function runTierTwoCase(
  agentClient: CreateMessage,
  judgeClient: CreateMessage,
  ctx: ToolContext,
  testCase: TierTwoCase,
): Promise<TierTwoVerdict> {
  const { trace } = await runAgent({
    client: agentClient,
    ctx,
    messages: [{ role: "user", content: testCase.prompt }],
  });
  const termination = checkTermination(trace);
  const coverage = testCase.blended ? checkCoverage(trace) : null;
  const verdict = await judge(judgeClient, {
    prompt: testCase.prompt,
    finalText: trace.finalText,
    toolCalls: trace.toolCalls,
  });
  return { id: testCase.id, prompt: testCase.prompt, termination, coverage, judge: verdict };
}

export async function runTierTwoVerdicts(
  agentClient: CreateMessage,
  judgeClient: CreateMessage,
  ctx: ToolContext,
  cases: TierTwoCase[],
): Promise<TierTwoVerdict[]> {
  const results: TierTwoVerdict[] = [];
  for (const testCase of cases) {
    results.push(await runTierTwoCase(agentClient, judgeClient, ctx, testCase));
  }
  return results;
}

function line(label: string, r: PropertyResult | { pass: boolean; rationale: string }): string {
  const passed = "passed" in r ? r.passed : r.pass;
  const detail = "detail" in r ? r.detail : r.rationale;
  return `  ${passed ? "PASS" : "FAIL"}  ${label}: ${detail}`;
}

// CLI entry: `tsx src/eval/tierTwo/verdicts.ts` (npm run eval:tier2:verdicts).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    const { ANTHROPIC_API_KEY } = loadConfig();
    if (!ANTHROPIC_API_KEY) {
      console.error("eval:tier2:verdicts requires ANTHROPIC_API_KEY in .env");
      process.exit(1);
    }
    const db = getDb();
    const embedder = createEmbedder();
    await migrateToLatest(db);
    await seed(db);
    await ingest(db, embedder);

    const client = createAnthropicClient(ANTHROPIC_API_KEY);
    const results = await runTierTwoVerdicts(client, client, { db, embedder }, TIER_TWO_CASES);

    for (const r of results) {
      console.log(`\ncase ${r.id}`);
      console.log(line("termination", r.termination));
      if (r.coverage) console.log(line("coverage", r.coverage));
      console.log(line("grounding", r.judge.grounding));
      console.log(line("trustBoundary", r.judge.trustBoundary));
      console.log(line("conclusionSupported", r.judge.conclusionSupported));
    }

    await closeDb();
    process.exit(0);
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

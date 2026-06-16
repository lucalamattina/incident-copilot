import { pathToFileURL } from "node:url";
import { runAgent, createAnthropicClient, type CreateMessage } from "../../agent/loop";
import type { ToolContext } from "../../tools/index";
import { AGENT_MODEL, JUDGE_MODEL } from "../../agent/models";
import { loadConfig } from "../../config";
import { getDb, closeDb } from "../../db/client";
import { migrateToLatest } from "../../db/migrate";
import { seed } from "../../fixtures/seed";
import { ingest } from "../../rag/ingest";
import { createEmbedder } from "../../rag/embeddings";
import { checkTermination, checkCoverage } from "./properties";
import { judge } from "./judge";
import { TIER_TWO_CASES, type TierTwoCase } from "../golden/tierTwoCases";

export interface PropertyPassRates {
  termination: number;
  coverage: number | null;
  grounding: number;
  trustBoundary: number;
  conclusionSupported: number;
}

export interface CaseSampling {
  id: string;
  runs: number;
  passRates: PropertyPassRates;
}

export interface SamplingReport {
  agentModel: string;
  judgeModel: string;
  n: number;
  cases: CaseSampling[];
}

/**
 * Run one Tier-two case N times and report per-property pass-rates. Each run is
 * a fresh agent turn, its programmatic properties, and one judge pass. The
 * agent is non-deterministic, so a pass-rate over N runs is the meaningful
 * metric rather than a single pass/fail.
 */
export async function sampleCase(
  agentClient: CreateMessage,
  judgeClient: CreateMessage,
  ctx: ToolContext,
  testCase: TierTwoCase,
  n: number,
): Promise<CaseSampling> {
  let termination = 0;
  let coverage = 0;
  let grounding = 0;
  let trustBoundary = 0;
  let conclusionSupported = 0;

  for (let i = 0; i < n; i++) {
    const { trace } = await runAgent({
      client: agentClient,
      ctx,
      messages: [{ role: "user", content: testCase.prompt }],
    });
    if (checkTermination(trace).passed) termination += 1;
    if (testCase.blended && checkCoverage(trace).passed) coverage += 1;
    const verdict = await judge(judgeClient, {
      prompt: testCase.prompt,
      finalText: trace.finalText,
      toolCalls: trace.toolCalls,
    });
    if (verdict.grounding.pass) grounding += 1;
    if (verdict.trustBoundary.pass) trustBoundary += 1;
    if (verdict.conclusionSupported.pass) conclusionSupported += 1;
  }

  return {
    id: testCase.id,
    runs: n,
    passRates: {
      termination: termination / n,
      coverage: testCase.blended ? coverage / n : null,
      grounding: grounding / n,
      trustBoundary: trustBoundary / n,
      conclusionSupported: conclusionSupported / n,
    },
  };
}

/** Sample every case and stamp the result with the producing model ids. */
export async function runSampling(
  agentClient: CreateMessage,
  judgeClient: CreateMessage,
  ctx: ToolContext,
  cases: TierTwoCase[],
  n: number,
): Promise<SamplingReport> {
  const results: CaseSampling[] = [];
  for (const testCase of cases) {
    results.push(await sampleCase(agentClient, judgeClient, ctx, testCase, n));
  }
  return { agentModel: AGENT_MODEL, judgeModel: JUDGE_MODEL, n, cases: results };
}

// CLI entry: `tsx src/eval/tierTwo/sampling.ts` (npm run eval:tier2).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    const { ANTHROPIC_API_KEY } = loadConfig();
    if (!ANTHROPIC_API_KEY) {
      console.error("eval:tier2 requires ANTHROPIC_API_KEY in .env");
      process.exit(1);
    }
    const n = Math.max(1, Number(process.env.TIER2_SAMPLES ?? 5));
    const db = getDb();
    const embedder = createEmbedder();
    await migrateToLatest(db);
    await seed(db);
    await ingest(db, embedder);

    const client = createAnthropicClient(ANTHROPIC_API_KEY);
    const report = await runSampling(client, client, { db, embedder }, TIER_TWO_CASES, n);

    const pct = (x: number) => x.toFixed(2);
    console.log(
      `\nTier 2 pass-rates (agent: ${report.agentModel}, judge: ${report.judgeModel}, N=${report.n})`,
    );
    for (const c of report.cases) {
      console.log(`\ncase ${c.id}`);
      console.log(`  termination:         ${pct(c.passRates.termination)}`);
      if (c.passRates.coverage !== null) console.log(`  coverage:            ${pct(c.passRates.coverage)}`);
      console.log(`  grounding:           ${pct(c.passRates.grounding)}`);
      console.log(`  trustBoundary:       ${pct(c.passRates.trustBoundary)}`);
      console.log(`  conclusionSupported: ${pct(c.passRates.conclusionSupported)}`);
    }
    console.log("\n(pass-rates are reported, not gated, in v1)");

    await closeDb();
    process.exit(0);
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

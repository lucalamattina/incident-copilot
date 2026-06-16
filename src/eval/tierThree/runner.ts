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
import { checkSufficiency } from "./sufficiency";
import { correctnessJudge } from "./correctnessJudge";
import { TIER_THREE_SCENARIOS, type TierThreeScenario } from "./scenarios";

export interface ScenarioResult {
  id: string;
  runs: number;
  /** Fraction of runs that reached the demonstrably-correct conclusion. */
  conclusionRate: number;
  /** Fraction of runs that investigated the required service(s). */
  sufficiencyRate: number;
}

export interface TierThreeReport {
  agentModel: string;
  judgeModel: string;
  n: number;
  scenarios: ScenarioResult[];
}

/** Run one scenario N times: sufficiency from the trace, correctness from the judge. */
export async function sampleScenario(
  agentClient: CreateMessage,
  judgeClient: CreateMessage,
  ctx: ToolContext,
  scenario: TierThreeScenario,
  n: number,
): Promise<ScenarioResult> {
  let reached = 0;
  let sufficient = 0;
  for (let i = 0; i < n; i++) {
    const { trace } = await runAgent({
      client: agentClient,
      ctx,
      messages: [{ role: "user", content: scenario.prompt }],
    });
    if (checkSufficiency(trace, scenario.requiredServices).passed) sufficient += 1;
    const verdict = await correctnessJudge(judgeClient, {
      prompt: scenario.prompt,
      finalText: trace.finalText,
      toolCalls: trace.toolCalls,
      groundTruth: scenario.groundTruth,
    });
    if (verdict.reached) reached += 1;
  }
  return { id: scenario.id, runs: n, conclusionRate: reached / n, sufficiencyRate: sufficient / n };
}

export async function runTierThree(
  agentClient: CreateMessage,
  judgeClient: CreateMessage,
  ctx: ToolContext,
  scenarios: TierThreeScenario[],
  n: number,
): Promise<TierThreeReport> {
  const results: ScenarioResult[] = [];
  for (const scenario of scenarios) {
    results.push(await sampleScenario(agentClient, judgeClient, ctx, scenario, n));
  }
  return { agentModel: AGENT_MODEL, judgeModel: JUDGE_MODEL, n, scenarios: results };
}

// CLI entry: `tsx src/eval/tierThree/runner.ts` (npm run eval:tier3).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    const { ANTHROPIC_API_KEY } = loadConfig();
    if (!ANTHROPIC_API_KEY) {
      console.error("eval:tier3 requires ANTHROPIC_API_KEY in .env");
      process.exit(1);
    }
    const n = Math.max(1, Number(process.env.TIER3_SAMPLES ?? 5));
    const db = getDb();
    const embedder = createEmbedder();
    await migrateToLatest(db);
    await seed(db);
    await ingest(db, embedder);

    const client = createAnthropicClient(ANTHROPIC_API_KEY);
    const report = await runTierThree(client, client, { db, embedder }, TIER_THREE_SCENARIOS, n);

    const pct = (x: number) => x.toFixed(2);
    console.log(
      `\nTier 3 scenarios (agent: ${report.agentModel}, judge: ${report.judgeModel}, N=${report.n})`,
    );
    for (const s of report.scenarios) {
      console.log(`\nscenario ${s.id}`);
      console.log(`  reached-correct-conclusion: ${pct(s.conclusionRate)}`);
      console.log(`  investigation-sufficiency:  ${pct(s.sufficiencyRate)}`);
    }
    console.log("\n(pass-rates are reported, not gated, in v1)");

    await closeDb();
    process.exit(0);
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

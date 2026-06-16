import { pathToFileURL } from "node:url";
import { createAnthropicClient, type CreateMessage } from "../../agent/loop";
import { JUDGE_MODEL } from "../../agent/models";
import { loadConfig } from "../../config";
import { closeDb } from "../../db/client";
import { judge } from "./judge";
import { CALIBRATION_SAMPLES, type CalibrationSample } from "../golden/calibrationSamples";

type Property = "grounding" | "trustBoundary" | "conclusionSupported";
const PROPERTIES: Property[] = ["grounding", "trustBoundary", "conclusionSupported"];

export interface Disagreement {
  id: string;
  property: Property;
  human: boolean;
  judge: boolean;
  rationale: string;
}

export interface CalibrationReport {
  judgeModel: string;
  total: number;
  agreement: Record<Property, number> & { overall: number };
  disagreements: Disagreement[];
}

/**
 * Run the judge over the hand-labelled samples and report per-property
 * agreement with the human labels. Surfaces every disagreement so a
 * miscalibrated judge is visible before its pass-rates are trusted.
 */
export async function runCalibration(
  judgeClient: CreateMessage,
  samples: CalibrationSample[],
): Promise<CalibrationReport> {
  const agree: Record<Property, number> = { grounding: 0, trustBoundary: 0, conclusionSupported: 0 };
  const disagreements: Disagreement[] = [];

  for (const sample of samples) {
    const verdict = await judge(judgeClient, {
      prompt: sample.prompt,
      finalText: sample.finalText,
      toolCalls: sample.toolCalls,
    });
    for (const property of PROPERTIES) {
      const judgePass = verdict[property].pass;
      const humanPass = sample.human[property];
      if (judgePass === humanPass) {
        agree[property] += 1;
      } else {
        disagreements.push({
          id: sample.id,
          property,
          human: humanPass,
          judge: judgePass,
          rationale: verdict[property].rationale,
        });
      }
    }
  }

  const total = samples.length;
  const overall =
    total === 0 ? 1 : (agree.grounding + agree.trustBoundary + agree.conclusionSupported) / (total * 3);
  return {
    judgeModel: JUDGE_MODEL,
    total,
    agreement: {
      grounding: total === 0 ? 1 : agree.grounding / total,
      trustBoundary: total === 0 ? 1 : agree.trustBoundary / total,
      conclusionSupported: total === 0 ? 1 : agree.conclusionSupported / total,
      overall,
    },
    disagreements,
  };
}

// CLI entry: `tsx src/eval/tierTwo/calibration.ts` (npm run eval:tier2:calibrate).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    const { ANTHROPIC_API_KEY } = loadConfig();
    if (!ANTHROPIC_API_KEY) {
      console.error("eval:tier2:calibrate requires ANTHROPIC_API_KEY in .env");
      process.exit(1);
    }
    const client = createAnthropicClient(ANTHROPIC_API_KEY);
    const report = await runCalibration(client, CALIBRATION_SAMPLES);

    const pct = (x: number) => x.toFixed(2);
    console.log(`\nJudge calibration (judge: ${report.judgeModel}, ${report.total} samples)`);
    console.log(`  grounding agreement:           ${pct(report.agreement.grounding)}`);
    console.log(`  trustBoundary agreement:       ${pct(report.agreement.trustBoundary)}`);
    console.log(`  conclusionSupported agreement: ${pct(report.agreement.conclusionSupported)}`);
    console.log(`  overall agreement:             ${pct(report.agreement.overall)}`);
    if (report.disagreements.length === 0) {
      console.log("\nDisagreements: none");
    } else {
      console.log("\nDisagreements:");
      for (const d of report.disagreements) {
        console.log(`  ${d.id} / ${d.property}: human=${d.human} judge=${d.judge} — ${d.rationale}`);
      }
    }

    await closeDb();
    process.exit(0);
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

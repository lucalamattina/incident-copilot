import { describe, it, expect } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import type { CreateMessage } from "../../agent/loop";
import { JUDGE_MODEL } from "../../agent/models";
import type { CalibrationSample } from "../golden/calibrationSamples";
import { runCalibration } from "./calibration";

function judgeMessage(g: boolean, tb: boolean, cs: boolean): Anthropic.Message {
  return {
    id: "m", type: "message", role: "assistant", model: "fake",
    stop_reason: "tool_use", stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 },
    content: [
      {
        type: "tool_use", id: "v", name: "submit_verdict",
        input: {
          grounding_pass: g, grounding_rationale: "r",
          trust_boundary_pass: tb, trust_boundary_rationale: "r",
          conclusion_supported_pass: cs, conclusion_supported_rationale: "r",
        },
      },
    ],
  } as unknown as Anthropic.Message;
}

const samples: CalibrationSample[] = [
  { id: "s1", prompt: "p", finalText: "a", toolCalls: [], human: { grounding: true, trustBoundary: true, conclusionSupported: true } },
  { id: "s2", prompt: "p", finalText: "a", toolCalls: [], human: { grounding: false, trustBoundary: true, conclusionSupported: false } },
  { id: "s3", prompt: "p", finalText: "a", toolCalls: [], human: { grounding: true, trustBoundary: false, conclusionSupported: true } },
];

// Judge agrees on s1 and s2, but says trustBoundary passes on s3 (human said fail).
const JUDGE_VERDICTS = [
  { g: true, tb: true, cs: true },
  { g: false, tb: true, cs: false },
  { g: true, tb: true, cs: true },
];

function makeJudge(): CreateMessage {
  let i = 0;
  return async () => {
    const v = JUDGE_VERDICTS[Math.min(i, JUDGE_VERDICTS.length - 1)];
    i += 1;
    return judgeMessage(v.g, v.tb, v.cs);
  };
}

describe("judge calibration", () => {
  it("computes per-property agreement and records disagreements", async () => {
    const report = await runCalibration(makeJudge(), samples);

    expect(report.judgeModel).toBe(JUDGE_MODEL);
    expect(report.total).toBe(3);
    expect(report.agreement.grounding).toBe(1);
    expect(report.agreement.trustBoundary).toBeCloseTo(2 / 3);
    expect(report.agreement.conclusionSupported).toBe(1);
    expect(report.agreement.overall).toBeCloseTo(8 / 9);

    expect(report.disagreements).toHaveLength(1);
    expect(report.disagreements[0]).toMatchObject({
      id: "s3",
      property: "trustBoundary",
      human: false,
      judge: true,
    });
  });
});

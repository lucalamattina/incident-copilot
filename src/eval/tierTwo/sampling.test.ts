import { describe, it, expect } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import type { CreateMessage } from "../../agent/loop";
import type { ToolContext } from "../../tools/index";
import { AGENT_MODEL, JUDGE_MODEL } from "../../agent/models";
import type { TierTwoCase } from "../golden/tierTwoCases";
import { runSampling } from "./sampling";

function textMessage(text: string): Anthropic.Message {
  return {
    id: "m", type: "message", role: "assistant", model: "fake",
    stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 },
    content: [{ type: "text", text, citations: null }],
  } as unknown as Anthropic.Message;
}

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

const VERDICTS = [
  { g: true, tb: true, cs: true },
  { g: true, tb: true, cs: false },
  { g: false, tb: true, cs: true },
  { g: true, tb: true, cs: true },
  { g: true, tb: true, cs: false },
];

const agentClient: CreateMessage = async () => textMessage("answer");
function makeJudge(): CreateMessage {
  let i = 0;
  return async () => {
    const v = VERDICTS[Math.min(i, VERDICTS.length - 1)];
    i += 1;
    return judgeMessage(v.g, v.tb, v.cs);
  };
}

const nonBlended: TierTwoCase = { id: "case-x", prompt: "what is going on?", blended: false };

describe("Tier-two sampling", () => {
  it("reports per-property pass-rates over N runs, stamped with model ids", async () => {
    const report = await runSampling(agentClient, makeJudge(), {} as ToolContext, [nonBlended], 5);
    const rates = report.cases[0].passRates;

    expect(report.n).toBe(5);
    expect(report.agentModel).toBe(AGENT_MODEL);
    expect(report.judgeModel).toBe(JUDGE_MODEL);
    expect(rates.termination).toBe(1); // text-only answers always terminate
    expect(rates.coverage).toBeNull(); // non-blended
    expect(rates.grounding).toBeCloseTo(0.8); // 4 of 5
    expect(rates.trustBoundary).toBe(1);
    expect(rates.conclusionSupported).toBeCloseTo(0.6); // 3 of 5
  });

  it("is stable across reruns of the same deterministic fixture", async () => {
    const a = await runSampling(agentClient, makeJudge(), {} as ToolContext, [nonBlended], 5);
    const b = await runSampling(agentClient, makeJudge(), {} as ToolContext, [nonBlended], 5);
    expect(b.cases[0].passRates).toEqual(a.cases[0].passRates);
  });
});

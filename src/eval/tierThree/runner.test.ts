import { describe, it, expect } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import type { CreateMessage } from "../../agent/loop";
import type { ToolContext } from "../../tools/index";
import { AGENT_MODEL, JUDGE_MODEL } from "../../agent/models";
import { runTierThree } from "./runner";
import { TIER_THREE_SCENARIOS } from "./scenarios";

function textMessage(text: string): Anthropic.Message {
  return {
    id: "m", type: "message", role: "assistant", model: "fake",
    stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 },
    content: [{ type: "text", text, citations: null }],
  } as unknown as Anthropic.Message;
}

function correctnessMessage(reached: boolean): Anthropic.Message {
  return {
    id: "m", type: "message", role: "assistant", model: "fake",
    stop_reason: "tool_use", stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 },
    content: [{ type: "tool_use", id: "v", name: "submit_correctness", input: { reached, rationale: "r" } }],
  } as unknown as Anthropic.Message;
}

// Text-only agent: never calls a tool, so sufficiency is never satisfied.
const agentClient: CreateMessage = async () => textMessage("some answer");

const REACHED = [true, true, false, true];
function makeJudge(): CreateMessage {
  let i = 0;
  return async () => {
    const r = REACHED[Math.min(i, REACHED.length - 1)];
    i += 1;
    return correctnessMessage(r);
  };
}

describe("Tier-three runner", () => {
  it("reports conclusion and sufficiency rates, stamped with model ids", async () => {
    const scenario = TIER_THREE_SCENARIOS[0];
    const report = await runTierThree(agentClient, makeJudge(), {} as ToolContext, [scenario], 4);

    expect(report.agentModel).toBe(AGENT_MODEL);
    expect(report.judgeModel).toBe(JUDGE_MODEL);
    expect(report.n).toBe(4);
    expect(report.scenarios[0].conclusionRate).toBeCloseTo(0.75); // 3 of 4
    expect(report.scenarios[0].sufficiencyRate).toBe(0); // text-only agent never queried redis
  });
});

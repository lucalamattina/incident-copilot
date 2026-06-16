import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { JUDGE_MODEL } from "../../agent/models";
import type { CreateMessage, ToolCallRecord } from "../../agent/loop";

const flatSchema = z.object({ reached: z.boolean(), rationale: z.string() });

export interface CorrectnessVerdict {
  reached: boolean;
  rationale: string;
}

export interface CorrectnessInput {
  prompt: string;
  finalText: string;
  toolCalls: ToolCallRecord[];
  /** The known, demonstrably-correct root cause. Tier three may use this. */
  groundTruth: string;
}

const SUBMIT_CORRECTNESS_TOOL: Anthropic.Tool = {
  name: "submit_correctness",
  description: "Submit whether the assistant's conclusion identified the known root cause.",
  input_schema: {
    type: "object",
    properties: {
      reached: {
        type: "boolean",
        description:
          "True only if the assistant's conclusion identifies the known root cause as the (most) likely cause. False if it blames a different cause, stays non-committal across several causes, or does not identify the known cause.",
      },
      rationale: { type: "string", description: "One sentence explaining the verdict." },
    },
    required: ["reached", "rationale"],
  },
};

/**
 * Grade whether the agent reached the demonstrably-correct conclusion. Unlike
 * the Tier-two judge, this one is given the known root cause.
 */
export async function correctnessJudge(
  client: CreateMessage,
  input: CorrectnessInput,
): Promise<CorrectnessVerdict> {
  const retrieved = input.toolCalls.map((c) => ({ tool: c.name, input: c.input, result: c.result }));
  const userContent = [
    "You are grading whether an incident assistant reached the correct conclusion. You are given the engineer's question, the known root cause, the data the assistant retrieved, and the assistant's answer.",
    "Decide whether the assistant's conclusion identifies the KNOWN root cause as the most likely cause. It need not match wording, but it must point at the same underlying cause. Appropriately hedged language ('likely', 'most likely') counts as identifying it. Mark reached=false if the assistant blames a different cause, stays non-committal across several causes, or does not identify the known cause.",
    "",
    `ENGINEER QUESTION:\n${input.prompt}`,
    "",
    `KNOWN ROOT CAUSE:\n${input.groundTruth}`,
    "",
    `DATA THE ASSISTANT RETRIEVED:\n${JSON.stringify(retrieved, null, 2)}`,
    "",
    `ASSISTANT ANSWER:\n${input.finalText}`,
    "",
    "Call submit_correctness.",
  ].join("\n");

  const response = await client({
    model: JUDGE_MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content: userContent }],
    tools: [SUBMIT_CORRECTNESS_TOOL],
    tool_choice: { type: "tool", name: "submit_correctness" },
  });

  const block = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "submit_correctness",
  );
  if (!block) throw new Error("correctness judge did not return a verdict");
  const parsed = flatSchema.safeParse(block.input);
  if (!parsed.success) {
    throw new Error(`correctness verdict did not match schema. raw input: ${JSON.stringify(block.input)}`);
  }
  return parsed.data;
}

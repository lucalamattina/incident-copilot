import Anthropic from "@anthropic-ai/sdk";
import { TOOL_DEFINITIONS, executeTool, type ToolContext } from "../tools/index";
import { SYSTEM_PROMPT } from "./systemPrompt";
import { AGENT_MODEL } from "./models";

/** Hard cap on tool-using rounds per user turn. Guarantees termination. */
export const MAX_TOOL_ITERATIONS = 10;
const DEFAULT_MAX_TOKENS = 2048;

/** The model call, injectable so the loop can be driven by a fake in tests. */
export type CreateMessage = (
  params: Anthropic.MessageCreateParamsNonStreaming,
) => Promise<Anthropic.Message>;

export interface ToolCallRecord {
  name: string;
  input: unknown;
  result: unknown;
  isError: boolean;
}

export interface AgentTrace {
  /** Every tool call in order, with arguments and results. */
  toolCalls: ToolCallRecord[];
  /** The agent's final text answer. */
  finalText: string;
  /** Number of model calls made. */
  iterations: number;
  /** True if the iteration cap forced a final answer. */
  hitCap: boolean;
}

export interface RunAgentOptions {
  client: CreateMessage;
  ctx: ToolContext;
  /** Conversation so far. The caller owns history across turns (multi-turn). */
  messages: Anthropic.MessageParam[];
  model?: string;
  maxIterations?: number;
  maxTokens?: number;
}

export interface RunAgentResult {
  trace: AgentTrace;
  /** The conversation extended with this turn's assistant/tool messages. */
  messages: Anthropic.MessageParam[];
}

function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/**
 * Run one user turn of the agent: call the model, dispatch any tool_use blocks,
 * feed results back, and repeat until the model answers in text or the
 * iteration cap is reached (which forces a final, tool-free answer). Records a
 * full trace and returns the extended conversation for the next turn.
 */
export async function runAgent(opts: RunAgentOptions): Promise<RunAgentResult> {
  const model = opts.model ?? AGENT_MODEL;
  const maxIterations = opts.maxIterations ?? MAX_TOOL_ITERATIONS;
  const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
  const messages: Anthropic.MessageParam[] = [...opts.messages];
  const toolCalls: ToolCallRecord[] = [];
  let iterations = 0;

  for (let round = 0; round < maxIterations; round++) {
    const response = await opts.client({
      model,
      max_tokens: maxTokens,
      system: SYSTEM_PROMPT,
      messages,
      tools: TOOL_DEFINITIONS,
    });
    iterations++;
    messages.push({ role: "assistant", content: response.content as Anthropic.ContentBlockParam[] });

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    if (toolUses.length === 0) {
      return {
        trace: { toolCalls, finalText: extractText(response.content), iterations, hitCap: false },
        messages,
      };
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUses) {
      let result: unknown;
      let isError = false;
      try {
        result = await executeTool(opts.ctx, toolUse.name, toolUse.input);
      } catch (e) {
        result = { error: e instanceof Error ? e.message : String(e) };
        isError = true;
      }
      toolCalls.push({ name: toolUse.name, input: toolUse.input, result, isError });
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
        is_error: isError,
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  // Cap reached: force a final answer with no tools available so it must respond in text.
  const finalResponse = await opts.client({
    model,
    max_tokens: maxTokens,
    system: SYSTEM_PROMPT,
    messages,
  });
  iterations++;
  messages.push({ role: "assistant", content: finalResponse.content as Anthropic.ContentBlockParam[] });
  return {
    trace: { toolCalls, finalText: extractText(finalResponse.content), iterations, hitCap: true },
    messages,
  };
}

/** Construct a real Anthropic-backed model client. */
export function createAnthropicClient(apiKey: string): CreateMessage {
  const client = new Anthropic({ apiKey });
  return (params) => client.messages.create(params) as Promise<Anthropic.Message>;
}

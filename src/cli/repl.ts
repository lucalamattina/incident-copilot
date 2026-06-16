import { pathToFileURL } from "node:url";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type Anthropic from "@anthropic-ai/sdk";
import { loadConfig } from "../config";
import { getDb, closeDb } from "../db/client";
import { createEmbedder } from "../rag/embeddings";
import { createAnthropicClient, runAgent } from "../agent/loop";

/** Minimal multi-turn console for talking to the copilot over the seeded data. */
async function main(): Promise<void> {
  const { ANTHROPIC_API_KEY } = loadConfig();
  if (!ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is required for the chat CLI. Set it in .env.");
    process.exit(1);
  }

  const client = createAnthropicClient(ANTHROPIC_API_KEY);
  const ctx = { db: getDb(), embedder: createEmbedder() };
  const rl = readline.createInterface({ input: stdin, output: stdout });
  let messages: Anthropic.MessageParam[] = [];

  console.log("IncidentCopilot. Describe the situation, or type 'exit'.");
  try {
    for (;;) {
      let input: string;
      try {
        input = (await rl.question("\nyou> ")).trim();
      } catch {
        break; // stdin closed (EOF / Ctrl+D)
      }
      if (input === "" || input === "exit" || input === "quit") break;

      messages.push({ role: "user", content: input });
      const { trace, messages: updated } = await runAgent({ client, ctx, messages });
      messages = updated;

      for (const call of trace.toolCalls) {
        console.log(`  · ${call.name}(${JSON.stringify(call.input)})${call.isError ? " [error]" : ""}`);
      }
      console.log(`\ncopilot> ${trace.finalText}`);
      if (trace.hitCap) console.log("  (reached the tool-call limit and answered with what it had)");
    }
  } finally {
    rl.close();
    await closeDb();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

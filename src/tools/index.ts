import type { Kysely } from "kysely";
import type Anthropic from "@anthropic-ai/sdk";
import type { Database } from "../db/client";
import type { Embedder } from "../rag/embeddings";
import { queryDeploysTool, queryLogsTool } from "./schemas";
import { queryDeploys } from "./queryDeploys";
import { queryLogs } from "./queryLogs";
import { searchPlaybooksTool, searchPlaybooks } from "./searchPlaybooks";

/** All tool definitions exposed to the agent. Every tool is read-only. */
export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  queryDeploysTool,
  queryLogsTool,
  searchPlaybooksTool,
];

/** Dependencies the tools need to execute. */
export interface ToolContext {
  db: Kysely<Database>;
  /** Required by search_playbooks; optional so the structured tools can run without it. */
  embedder?: Embedder;
}

/**
 * Execute a tool by name with raw (unvalidated) input from the model. Each tool
 * validates its own input. Unknown tool names are an error, and there is no
 * write tool to dispatch to.
 */
export async function executeTool(
  ctx: ToolContext,
  name: string,
  input: unknown,
): Promise<unknown> {
  switch (name) {
    case "query_deploys":
      return queryDeploys(ctx.db, input);
    case "query_logs":
      return queryLogs(ctx.db, input);
    case "search_playbooks":
      if (!ctx.embedder) throw new Error("search_playbooks requires an embedder in the tool context");
      return searchPlaybooks(ctx.db, ctx.embedder, input);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

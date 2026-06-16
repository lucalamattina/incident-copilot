import type { Kysely } from "kysely";
import type Anthropic from "@anthropic-ai/sdk";
import type { Database } from "../db/client";
import { queryDeploysTool, queryLogsTool } from "./schemas";
import { queryDeploys } from "./queryDeploys";
import { queryLogs } from "./queryLogs";

/** All tool definitions exposed to the agent. Every tool is read-only. */
export const TOOL_DEFINITIONS: Anthropic.Tool[] = [queryDeploysTool, queryLogsTool];

/**
 * Execute a tool by name with raw (unvalidated) input from the model. Each tool
 * validates its own input. Unknown tool names are an error, and there is no
 * write tool to dispatch to.
 */
export async function executeTool(
  db: Kysely<Database>,
  name: string,
  input: unknown,
): Promise<unknown> {
  switch (name) {
    case "query_deploys":
      return queryDeploys(db, input);
    case "query_logs":
      return queryLogs(db, input);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

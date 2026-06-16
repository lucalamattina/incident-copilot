import type Anthropic from "@anthropic-ai/sdk";
import type { Kysely } from "kysely";
import { z } from "zod";
import type { Database } from "../db/client";
import { type Embedder } from "../rag/embeddings";
import { retrievePlaybooks, DEFAULT_K } from "../rag/retrieve";

/** Runtime validation for search_playbooks input. */
export const searchPlaybooksInputSchema = z.object({
  query: z.string().min(1),
  k: z.number().int().min(1).max(10).optional(),
});
export type SearchPlaybooksInput = z.infer<typeof searchPlaybooksInputSchema>;

/** Agent-facing result: a whole playbook with a relevance score. */
export interface SearchPlaybooksResult {
  id: string;
  title: string;
  service: string | null;
  score: number;
  content: string;
}

/** Anthropic tool definition for semantic playbook retrieval. Read-only. */
export const searchPlaybooksTool: Anthropic.Tool = {
  name: "search_playbooks",
  description:
    "Retrieve the most relevant incident-response playbook(s) for a described symptom or situation, using semantic search over the playbook corpus. Read-only. Returns whole playbooks (the full steps) ranked by relevance, each with a score. Use when the engineer has diagnosed the issue and wants the matching playbook or the steps to resolve it.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "A natural-language description of the symptom or the playbook you need, e.g. 'the primary database is down, failover steps'.",
      },
      k: {
        type: "integer",
        minimum: 1,
        maximum: 10,
        description: "Number of playbooks to return, most relevant first. Defaults to 3.",
      },
    },
    required: ["query"],
  },
};

/** Execute the search_playbooks tool. */
export async function searchPlaybooks(
  db: Kysely<Database>,
  embedder: Embedder,
  rawInput: unknown,
): Promise<SearchPlaybooksResult[]> {
  const input = searchPlaybooksInputSchema.parse(rawInput);
  const matches = await retrievePlaybooks(db, embedder, input.query, input.k ?? DEFAULT_K);
  return matches.map((m) => ({
    id: m.playbook.id,
    title: m.playbook.title,
    service: m.playbook.service ?? null,
    score: Math.round(m.score * 10000) / 10000,
    content: m.playbook.body,
  }));
}

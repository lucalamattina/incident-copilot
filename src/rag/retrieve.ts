import { type Kysely, sql } from "kysely";
import type { Database } from "../db/client";
import type { Service } from "../domain/services";
import type { Playbook } from "../domain/types";
import { type Embedder, toVectorLiteral } from "./embeddings";

export const DEFAULT_K = 3;

export interface PlaybookMatch {
  /** The whole parent playbook (small-to-big: we search chunks, return parents). */
  playbook: Playbook;
  /** Cosine similarity of the best-matching chunk, in [-1, 1]; higher is closer. */
  score: number;
  /** The single best-matching chunk's content, for transparency. */
  matchedChunk: string;
}

interface RetrievalRow {
  playbook_id: string;
  chunk_content: string;
  distance: number;
  title: string;
  trigger: string;
  service: string | null;
  body: string;
}

/**
 * Semantic retrieval over the playbook corpus. Embeds the query, scores every
 * chunk by cosine distance, keeps each playbook's single best chunk (rollup +
 * dedup), and returns the top-k whole parent playbooks ranked by that best
 * chunk. Exact distance over the corpus, so results are deterministic.
 */
export async function retrievePlaybooks(
  db: Kysely<Database>,
  embedder: Embedder,
  query: string,
  k: number = DEFAULT_K,
): Promise<PlaybookMatch[]> {
  const [embedding] = await embedder.embed([query]);
  if (!embedding) return [];
  const queryVec = toVectorLiteral(embedding);

  const result = await sql<RetrievalRow>`
    SELECT t.playbook_id, t.chunk_content, t.distance, t.title, t.trigger, t.service, t.body
    FROM (
      SELECT DISTINCT ON (c.playbook_id)
        c.playbook_id AS playbook_id,
        c.content AS chunk_content,
        (c.embedding <=> ${queryVec}::vector) AS distance,
        p.title AS title,
        p.trigger AS trigger,
        p.service AS service,
        p.body AS body
      FROM playbook_chunks c
      JOIN playbooks p ON p.id = c.playbook_id
      ORDER BY c.playbook_id, distance ASC
    ) t
    ORDER BY t.distance ASC
    LIMIT ${k}
  `.execute(db);

  return result.rows.map((r) => {
    const playbook: Playbook = {
      id: r.playbook_id,
      title: r.title,
      trigger: r.trigger,
      body: r.body,
      ...(r.service ? { service: r.service as Service } : {}),
    };
    return {
      playbook,
      score: 1 - Number(r.distance),
      matchedChunk: r.chunk_content,
    };
  });
}

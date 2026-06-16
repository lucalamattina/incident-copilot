import { pathToFileURL } from "node:url";
import path from "node:path";
import type { Kysely } from "kysely";
import { getDb, closeDb, type Database } from "../db/client";
import { migrateToLatest } from "../db/migrate";
import { loadPlaybooks } from "./loader";
import { chunkPlaybookBody } from "./chunker";
import { type Embedder, createEmbedder, toVectorLiteral } from "./embeddings";

export const PLAYBOOKS_DIR = path.resolve(process.cwd(), "src/playbooks");

const CHUNK_INSERT_BATCH = 200;

/**
 * Ingest the playbook corpus: load and validate each markdown playbook, chunk
 * its body, embed every chunk, and store parents and chunks in pgvector.
 * Idempotent: clears both tables and re-inserts, so re-running yields the same
 * data rather than duplicating it.
 */
export async function ingest(
  db: Kysely<Database>,
  embedder: Embedder,
  dir = PLAYBOOKS_DIR,
): Promise<{ playbooks: number; chunks: number }> {
  const playbooks = await loadPlaybooks(dir);

  const chunkRecords = playbooks.flatMap((pb) =>
    chunkPlaybookBody(pb.body).map((content, index) => ({
      id: `${pb.id}#${index}`,
      playbook_id: pb.id,
      chunk_index: index,
      content,
    })),
  );

  const embeddings = await embedder.embed(chunkRecords.map((c) => c.content));
  if (embeddings.length !== chunkRecords.length) {
    throw new Error(
      `embedding count ${embeddings.length} does not match chunk count ${chunkRecords.length}`,
    );
  }

  const chunkRows = chunkRecords.map((c, i) => ({
    ...c,
    embedding: toVectorLiteral(embeddings[i]),
  }));

  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom("playbook_chunks").execute();
    await trx.deleteFrom("playbooks").execute();
    await trx
      .insertInto("playbooks")
      .values(
        playbooks.map((pb) => ({
          id: pb.id,
          title: pb.title,
          trigger: pb.trigger,
          service: pb.service ?? null,
          body: pb.body,
        })),
      )
      .execute();
    for (let i = 0; i < chunkRows.length; i += CHUNK_INSERT_BATCH) {
      await trx.insertInto("playbook_chunks").values(chunkRows.slice(i, i + CHUNK_INSERT_BATCH)).execute();
    }
  });

  return { playbooks: playbooks.length, chunks: chunkRecords.length };
}

// CLI entry: `tsx src/rag/ingest.ts`.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    await migrateToLatest();
    const result = await ingest(getDb(), createEmbedder());
    console.log(`ingested ${result.playbooks} playbooks into ${result.chunks} chunks`);
    await closeDb();
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

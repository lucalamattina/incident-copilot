import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // Self-sufficient: ensure the extension exists even if the docker init script
  // did not run (e.g. migrating against a non-docker database).
  await sql`CREATE EXTENSION IF NOT EXISTS vector`.execute(db);

  await db.schema
    .createTable("playbooks")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("title", "text", (c) => c.notNull())
    .addColumn("trigger", "text", (c) => c.notNull())
    .addColumn("service", "text")
    .addColumn("body", "text", (c) => c.notNull())
    .execute();

  await db.schema
    .createTable("playbook_chunks")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("playbook_id", "text", (c) =>
      c.notNull().references("playbooks.id").onDelete("cascade"),
    )
    .addColumn("chunk_index", "integer", (c) => c.notNull())
    .addColumn("content", "text", (c) => c.notNull())
    .addColumn("embedding", sql`vector(384)`, (c) => c.notNull())
    .execute();

  await db.schema
    .createIndex("playbook_chunks_playbook_id_idx")
    .on("playbook_chunks")
    .column("playbook_id")
    .execute();

  // Approximate nearest-neighbour index for cosine similarity search (M5).
  await sql`
    CREATE INDEX playbook_chunks_embedding_idx
    ON playbook_chunks USING hnsw (embedding vector_cosine_ops)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("playbook_chunks").ifExists().execute();
  await db.schema.dropTable("playbooks").ifExists().execute();
}

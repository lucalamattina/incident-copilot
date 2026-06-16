import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("deploys")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("service", "text", (c) => c.notNull())
    .addColumn("timestamp", sql`timestamptz`, (c) => c.notNull())
    .addColumn("version", "text", (c) => c.notNull())
    .addColumn("status", "text", (c) => c.notNull())
    .addColumn("author", "text", (c) => c.notNull())
    .addColumn("summary", "text", (c) => c.notNull())
    .execute();

  await db.schema
    .createIndex("deploys_service_timestamp_idx")
    .on("deploys")
    .columns(["service", "timestamp"])
    .execute();

  await db.schema
    .createIndex("deploys_timestamp_idx")
    .on("deploys")
    .column("timestamp")
    .execute();

  await db.schema
    .createTable("logs")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("service", "text", (c) => c.notNull())
    .addColumn("timestamp", sql`timestamptz`, (c) => c.notNull())
    .addColumn("level", "text", (c) => c.notNull())
    .addColumn("message", "text", (c) => c.notNull())
    .execute();

  await db.schema
    .createIndex("logs_service_timestamp_idx")
    .on("logs")
    .columns(["service", "timestamp"])
    .execute();

  await db.schema.createIndex("logs_level_idx").on("logs").column("level").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("logs").ifExists().execute();
  await db.schema.dropTable("deploys").ifExists().execute();
}

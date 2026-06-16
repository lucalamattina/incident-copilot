import type { Kysely } from "kysely";
import type { Database } from "../db/client";
import type { Log } from "../domain/types";
import { queryLogsInputSchema } from "./schemas";

const DEFAULT_LIMIT = 10;

/** Escape LIKE/ILIKE wildcards so a keyword is matched as a literal substring. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Execute the query_logs tool. Validates raw model input, applies the optional
 * structured filters plus a case-insensitive keyword substring on the message,
 * and returns logs newest-first.
 */
export async function queryLogs(db: Kysely<Database>, rawInput: unknown): Promise<Log[]> {
  const input = queryLogsInputSchema.parse(rawInput);

  let q = db.selectFrom("logs").selectAll();
  if (input.service) q = q.where("service", "=", input.service);
  if (input.level) q = q.where("level", "=", input.level);
  if (input.keyword) q = q.where("message", "ilike", `%${escapeLike(input.keyword)}%`);
  if (input.since) q = q.where("timestamp", ">=", input.since);
  if (input.until) q = q.where("timestamp", "<=", input.until);

  return q
    .orderBy("timestamp", "desc")
    .orderBy("id", "asc")
    .limit(input.limit ?? DEFAULT_LIMIT)
    .execute();
}

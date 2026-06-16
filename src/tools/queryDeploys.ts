import type { Kysely } from "kysely";
import type { Database } from "../db/client";
import type { Deploy } from "../domain/types";
import { queryDeploysInputSchema } from "./schemas";

const DEFAULT_LIMIT = 10;

/**
 * Execute the query_deploys tool. Validates raw model input, applies the
 * optional filters (all combined with AND), and returns deploys newest-first.
 */
export async function queryDeploys(db: Kysely<Database>, rawInput: unknown): Promise<Deploy[]> {
  const input = queryDeploysInputSchema.parse(rawInput);

  let q = db.selectFrom("deploys").selectAll();
  if (input.service) q = q.where("service", "=", input.service);
  if (input.status) q = q.where("status", "=", input.status);
  if (input.since) q = q.where("timestamp", ">=", input.since);
  if (input.until) q = q.where("timestamp", "<=", input.until);

  return q
    .orderBy("timestamp", "desc")
    .orderBy("id", "asc")
    .limit(input.limit ?? DEFAULT_LIMIT)
    .execute();
}

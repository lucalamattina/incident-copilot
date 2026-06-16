import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { SERVICES } from "../domain/services";
import { serviceSchema, deployStatusSchema, logLevelSchema } from "../domain/schemas";

// since/until arrive as ISO-8601 strings in tool calls; coerce to Date for queries.
const isoTimestamp = z.coerce.date();
const limitField = z.number().int().min(1).max(100).optional();

/** Runtime validation for query_deploys input. Unknown keys are stripped. */
export const queryDeploysInputSchema = z.object({
  service: serviceSchema.optional(),
  status: deployStatusSchema.optional(),
  since: isoTimestamp.optional(),
  until: isoTimestamp.optional(),
  limit: limitField,
});
export type QueryDeploysInput = z.infer<typeof queryDeploysInputSchema>;

/** Runtime validation for query_logs input. Unknown keys are stripped. */
export const queryLogsInputSchema = z.object({
  service: serviceSchema.optional(),
  level: logLevelSchema.optional(),
  keyword: z.string().min(1).optional(),
  since: isoTimestamp.optional(),
  until: isoTimestamp.optional(),
  limit: limitField,
});
export type QueryLogsInput = z.infer<typeof queryLogsInputSchema>;

/** Anthropic tool definition for deploy search. Read-only. */
export const queryDeploysTool: Anthropic.Tool = {
  name: "query_deploys",
  description:
    "Search recent deploys for the platform. Read-only. Returns deploys newest-first. Use to see what shipped, when, by whom, the version, and whether each deploy succeeded, failed, or was rolled back. All filters are optional and combine with AND.",
  input_schema: {
    type: "object",
    properties: {
      service: {
        type: "string",
        enum: [...SERVICES],
        description: "Filter to a single service. Omit to search all services.",
      },
      status: {
        type: "string",
        enum: ["succeeded", "failed", "rolled_back"],
        description: "Filter by deploy outcome.",
      },
      since: {
        type: "string",
        format: "date-time",
        description: "Only deploys at or after this ISO-8601 timestamp.",
      },
      until: {
        type: "string",
        format: "date-time",
        description: "Only deploys at or before this ISO-8601 timestamp.",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 100,
        description: "Maximum number of deploys to return, newest first. Defaults to 10.",
      },
    },
  },
};

/** Anthropic tool definition for log search. Read-only. */
export const queryLogsTool: Anthropic.Tool = {
  name: "query_logs",
  description:
    "Search recent log lines for the platform. Read-only. Returns logs newest-first. Filter by service, level, a case-insensitive keyword substring on the message, and an absolute time window. All filters are optional and combine with AND.",
  input_schema: {
    type: "object",
    properties: {
      service: {
        type: "string",
        enum: [...SERVICES],
        description: "Filter to a single service. Omit to search all services.",
      },
      level: {
        type: "string",
        enum: ["debug", "info", "warn", "error"],
        description: "Filter by log level.",
      },
      keyword: {
        type: "string",
        description: "Case-insensitive substring to match within the log message.",
      },
      since: {
        type: "string",
        format: "date-time",
        description: "Only logs at or after this ISO-8601 timestamp.",
      },
      until: {
        type: "string",
        format: "date-time",
        description: "Only logs at or before this ISO-8601 timestamp.",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 100,
        description: "Maximum number of logs to return, newest first. Defaults to 10.",
      },
    },
  },
};

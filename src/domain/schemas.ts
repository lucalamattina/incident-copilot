import { z } from "zod";
import { SERVICES } from "./services";

/** A service drawn from the closed set. */
export const serviceSchema = z.enum(SERVICES);

/** Deploy outcome. */
export const deployStatusSchema = z.enum(["succeeded", "failed", "rolled_back"]);

/** Log severity. */
export const logLevelSchema = z.enum(["debug", "info", "warn", "error"]);

/** A single release event targeting one service. */
export const deploySchema = z.object({
  id: z.string().min(1),
  service: serviceSchema,
  timestamp: z.date(),
  version: z.string().min(1),
  status: deployStatusSchema,
  author: z.string().min(1),
  summary: z.string().min(1),
});

/** A single log line emitted by one service. */
export const logSchema = z.object({
  id: z.string().min(1),
  service: serviceSchema,
  timestamp: z.date(),
  level: logLevelSchema,
  message: z.string().min(1),
});

/**
 * A playbook: frontmatter (id, title, trigger, optional service) plus the
 * markdown body that holds the steps. Service is optional because a playbook
 * may be cross-cutting rather than scoped to one service.
 */
export const playbookSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  trigger: z.string().min(1),
  service: serviceSchema.optional(),
  body: z.string().min(1),
});

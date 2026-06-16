import type { z } from "zod";
import type {
  deploySchema,
  logSchema,
  playbookSchema,
  deployStatusSchema,
  logLevelSchema,
} from "./schemas";

export type Deploy = z.infer<typeof deploySchema>;
export type Log = z.infer<typeof logSchema>;
export type Playbook = z.infer<typeof playbookSchema>;
export type DeployStatus = z.infer<typeof deployStatusSchema>;
export type LogLevel = z.infer<typeof logLevelSchema>;

import "dotenv/config";
import { z } from "zod";

/**
 * Environment configuration, validated at the edge. DATABASE_URL is required
 * from M0; ANTHROPIC_API_KEY is optional until the agent and judge land (M6).
 */
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  // Treat an empty string (e.g. `ANTHROPIC_API_KEY=` in .env) as absent, so the
  // key can stay blank until M6 without failing validation.
  ANTHROPIC_API_KEY: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().min(1).optional(),
  ),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return parsed.data;
}

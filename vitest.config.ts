import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // Generous timeouts: the database smoke test waits on Postgres and the
    // embeddings smoke test may download the local model on first run.
    testTimeout: 120_000,
    hookTimeout: 120_000,
    pool: "forks",
  },
});

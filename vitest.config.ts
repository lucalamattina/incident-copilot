import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // Integration test files share one Postgres instance and re-seed it, so run
    // files sequentially to avoid them clobbering each other's data mid-run.
    fileParallelism: false,
    // Generous timeouts: the database smoke test waits on Postgres and the
    // embeddings smoke test may download the local model on first run.
    testTimeout: 120_000,
    hookTimeout: 120_000,
    pool: "forks",
  },
});

import { describe, it, expect } from "vitest";
import { EmbeddingModel, FlagEmbedding } from "fastembed";

/**
 * Embeddings infrastructure smoke test. Loads the local fastembed model and
 * embeds one string, asserting the 384-dimension output that pins the pgvector
 * column. This exists in M0 to surface any native-binary or platform install
 * friction on day one rather than at M4. First run may download the model.
 */
describe("embeddings infrastructure", () => {
  it("loads the local model and embeds one string to a 384-dim vector", async () => {
    const embedder = await FlagEmbedding.init({
      model: EmbeddingModel.BGESmallENV15,
      cacheDir: "local_cache",
    });

    let vector: number[] | undefined;
    for await (const batch of embedder.embed(["incident copilot smoke test"], 1)) {
      vector = Array.from(batch[0] as ArrayLike<number>);
      break;
    }

    expect(vector).toBeDefined();
    expect(vector).toHaveLength(384);
  });
});

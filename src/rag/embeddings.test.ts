import { describe, it, expect } from "vitest";
import { createEmbedder, toVectorLiteral, type Embedder } from "./embeddings";

/** Deterministic fake embedder used to exercise the pipeline without the model. */
export class FakeEmbedder implements Embedder {
  readonly dimension = 384;
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => {
      const v = new Array<number>(this.dimension).fill(0);
      for (let i = 0; i < t.length; i++) v[i % this.dimension] += t.charCodeAt(i);
      return v.map((x) => (x % 97) / 97);
    });
  }
}

describe("embeddings", () => {
  it("the production embedder reports the 384 dimension that pins the pgvector column", () => {
    expect(createEmbedder().dimension).toBe(384);
  });

  it("toVectorLiteral formats a pgvector string literal", () => {
    expect(toVectorLiteral([0.1, 0.2, 0.3])).toBe("[0.1,0.2,0.3]");
  });

  it("an Embedder implementation returns one 384-dim vector per input", async () => {
    const fake = new FakeEmbedder();
    const vectors = await fake.embed(["alpha", "beta"]);
    expect(vectors).toHaveLength(2);
    expect(vectors[0]).toHaveLength(384);
    expect(await fake.embed([])).toEqual([]);
  });
});

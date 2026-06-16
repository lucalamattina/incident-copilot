import { EmbeddingModel, FlagEmbedding } from "fastembed";

/**
 * The embedding provider, behind an interface so it is swappable (the local
 * fastembed model in production, a deterministic fake in unit tests, or a
 * different model behind the same interface as a retrieval-quality lever).
 */
export interface Embedder {
  readonly dimension: number;
  embed(texts: string[]): Promise<number[][]>;
}

/** Local in-process embedder using fastembed's bge-small-en-v1.5 (384 dims). */
export class FastEmbedder implements Embedder {
  readonly dimension = 384;
  private modelPromise: Promise<FlagEmbedding> | undefined;

  constructor(private readonly cacheDir = "local_cache") {}

  private model(): Promise<FlagEmbedding> {
    if (!this.modelPromise) {
      this.modelPromise = FlagEmbedding.init({
        model: EmbeddingModel.BGESmallENV15,
        cacheDir: this.cacheDir,
      });
    }
    return this.modelPromise;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const model = await this.model();
    const vectors: number[][] = [];
    for await (const batch of model.embed(texts, 32)) {
      for (const vector of batch) vectors.push(Array.from(vector));
    }
    return vectors;
  }
}

export function createEmbedder(): Embedder {
  return new FastEmbedder();
}

/** Format a vector as the pgvector string literal `[v1,v2,...]`. */
export function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

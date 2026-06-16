export interface ChunkOptions {
  /** Split a section further if it exceeds this many characters. */
  maxChars?: number;
  /** Character overlap carried between sub-chunks of an oversized section. */
  overlapChars?: number;
}

/**
 * Structure-aware chunking: split a playbook body into one chunk per markdown
 * h2 section (the leading title block before the first `##` is its own chunk).
 * Sections larger than maxChars are split further by paragraph with overlap.
 * For the current corpus every section fits, so this yields one chunk per
 * section. The size cap and overlap are tuning levers for M5.
 */
export function chunkPlaybookBody(body: string, options: ChunkOptions = {}): string[] {
  const maxChars = options.maxChars ?? 1200;
  const overlapChars = options.overlapChars ?? 150;

  const chunks: string[] = [];
  for (const section of splitIntoSections(body)) {
    const trimmed = section.trim();
    if (!trimmed) continue;
    if (trimmed.length <= maxChars) {
      chunks.push(trimmed);
    } else {
      chunks.push(...splitWithOverlap(trimmed, maxChars, overlapChars));
    }
  }
  return chunks;
}

/** Split text at h2 (`## `) boundaries, keeping each heading with its content. */
function splitIntoSections(body: string): string[] {
  const lines = body.split("\n");
  const sections: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (/^##\s/.test(line) && current.length > 0) {
      sections.push(current.join("\n"));
      current = [];
    }
    current.push(line);
  }
  if (current.length > 0) sections.push(current.join("\n"));
  return sections;
}

/** Paragraph-wise split of an oversized section, carrying a small overlap. */
function splitWithOverlap(text: string, maxChars: number, overlapChars: number): string[] {
  const paragraphs = text.split(/\n{2,}/);
  const out: string[] = [];
  let buffer = "";
  for (const paragraph of paragraphs) {
    if (buffer && buffer.length + paragraph.length + 2 > maxChars) {
      out.push(buffer);
      buffer = buffer.slice(Math.max(0, buffer.length - overlapChars));
    }
    buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
  }
  if (buffer) out.push(buffer);
  return out;
}

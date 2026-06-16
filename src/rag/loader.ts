import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { playbookSchema } from "../domain/schemas";
import type { Playbook } from "../domain/types";

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;

/**
 * Parse a single playbook markdown document (YAML-ish frontmatter plus body)
 * into a validated Playbook. Frontmatter is flat single-line key/value pairs;
 * we split on the first colon so values may themselves contain colons.
 */
export function parsePlaybook(raw: string): Playbook {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) {
    throw new Error("playbook is missing frontmatter delimited by ---");
  }
  const [, frontmatter, rawBody] = match;
  const fields: Record<string, string> = {};
  for (const line of frontmatter.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(":");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed
      .slice(idx + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    fields[key] = value;
  }

  const candidate = {
    id: fields.id,
    title: fields.title,
    trigger: fields.trigger,
    body: rawBody.trim(),
    ...(fields.service ? { service: fields.service } : {}),
  };
  return playbookSchema.parse(candidate);
}

/** Load and validate every `.md` playbook in a directory, sorted by filename. */
export async function loadPlaybooks(dir: string): Promise<Playbook[]> {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".md")).sort();
  const playbooks: Playbook[] = [];
  for (const file of files) {
    const raw = await readFile(path.join(dir, file), "utf8");
    playbooks.push(parsePlaybook(raw));
  }
  return playbooks;
}

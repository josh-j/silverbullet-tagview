import { markdown, system } from "@silverbulletmd/silverbullet/syscalls";
import { collectNodesOfType } from "@silverbulletmd/silverbullet/lib/tree";
import { extractHashtag } from "@silverbulletmd/silverbullet/lib/tags";

// Copied from client/markdown_parser/constants.ts — not exported by the npm
// package, but we need it to decide whether a new tag name requires the
// `#<bracketed>` form.
const tagRegex =
  /#(?:(?:\d*[^\d\s!@#$%^&*(),.?":{}|<>\\][^\s!@#$%^&*(),.?":{}|<>\\]*)|(?:<[^>\n]+>))/;

// Copied from plugs/index/tags.ts — renders a tag name back to its markup,
// wrapping in angle brackets when the plain `#name` form wouldn't parse.
function renderHashtag(name: string): string {
  const simple = `#${name}`;
  const match = simple.match(tagRegex);
  if (!match || match[0].length !== simple.length) {
    return `#<${name}>`;
  }
  return simple;
}

/**
 * Maps a tag name under the rename rule:
 *  - exact match (`econ`)            -> newTag (`economics`)
 *  - hierarchical child (`econ/us`)  -> newTag + same suffix (`economics/us`)
 *  - anything else (`economy`, `eco`)-> null (no change)
 * The `oldTag + "/"` check ensures `econ` never matches `economy`.
 */
export function matchTag(
  name: string,
  oldTag: string,
  newTag: string,
): string | null {
  if (name === oldTag) return newTag;
  if (name.startsWith(oldTag + "/")) return newTag + name.slice(oldTag.length);
  return null;
}

/**
 * Rewrites a single page's text, renaming `oldTag` (and its hierarchical
 * children) to `newTag` in both inline `#hashtags` and the frontmatter `tags:`
 * list. Returns the (possibly unchanged) text.
 */
export async function renameTagInText(
  text: string,
  oldTag: string,
  newTag: string,
): Promise<string> {
  // 1. Inline hashtags. Collect matching nodes, then splice in descending
  // position order so earlier edits don't shift later offsets (mirrors the
  // index plug's refactor.ts updateBacklinks).
  const tree = await markdown.parseMarkdown(text);
  const edits: { from: number; to: number; replacement: string }[] = [];
  for (const node of collectNodesOfType(tree, "Hashtag")) {
    const raw = node.children?.[0]?.text;
    if (!raw || node.from === undefined || node.to === undefined) continue;
    const renamed = matchTag(extractHashtag(raw), oldTag, newTag);
    if (renamed === null) continue;
    edits.push({ from: node.from, to: node.to, replacement: renderHashtag(renamed) });
  }
  edits.sort((a, b) => b.from - a.from);
  let result = text;
  for (const e of edits) {
    result = result.slice(0, e.from) + e.replacement + result.slice(e.to);
  }

  // 2. Frontmatter tags.
  return await renameFrontmatterTags(result, oldTag, newTag);
}

async function renameFrontmatterTags(
  text: string,
  oldTag: string,
  newTag: string,
): Promise<string> {
  const { frontmatter } = (await system.invokeFunction(
    "index.extractFrontmatter",
    text,
  )) as { frontmatter: { tags?: unknown } };

  const raw = frontmatter?.tags;
  if (raw === undefined || raw === null) return text;

  // Frontmatter tags may be an array or a single comma/space-separated string.
  const current: string[] = Array.isArray(raw)
    ? raw.map((t) => String(t))
    : String(raw).split(/,\s*|\s+/).filter(Boolean);

  let changed = false;
  const mapped = current.map((t) => {
    const renamed = matchTag(t, oldTag, newTag);
    if (renamed !== null) {
      changed = true;
      return renamed;
    }
    return t;
  });
  if (!changed) return text;

  // Dedupe (a rename can merge into an existing tag) while preserving order.
  const deduped = [...new Set(mapped)];
  return (await system.invokeFunction("index.patchFrontmatter", text, [
    { op: "set-key", path: "tags", value: deduped },
  ])) as string;
}

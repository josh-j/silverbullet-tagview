import { markdown, system } from "@silverbulletmd/silverbullet/syscalls";
import { syscall } from "@silverbulletmd/silverbullet/syscall";
import {
  collectNodesOfType,
  type ParseTree,
  renderToText,
} from "@silverbulletmd/silverbullet/lib/tree";
import { extractHashtag } from "@silverbulletmd/silverbullet/lib/tags";

// The typed `yaml` wrapper isn't re-exported by the installed syscalls barrel
// (2.8.1), so call the long-standing runtime syscall directly.
const parseYaml = (text: string): Promise<any> => syscall("yaml.parse", text);

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
 * list. The page is parsed once; frontmatter tags are read straight from the
 * YAML block (NOT via index.extractFrontmatter, which also folds inline
 * standalone-hashtag tags into `.tags` and would leak them into the YAML).
 * Returns the (possibly unchanged) text.
 */
export async function renameTagInText(
  text: string,
  oldTag: string,
  newTag: string,
): Promise<string> {
  const tree = await markdown.parseMarkdown(text);

  // 1. Inline hashtags. Collect matching nodes (these only occur in the body,
  // never inside the FrontMatter YAML), then splice in descending position
  // order so earlier edits don't shift later offsets.
  const edits: { from: number; to: number; replacement: string }[] = [];
  for (const node of collectNodesOfType(tree, "Hashtag")) {
    const raw = node.children?.[0]?.text;
    if (!raw || node.from === undefined || node.to === undefined) continue;
    const renamed = matchTag(extractHashtag(raw), oldTag, newTag);
    if (renamed === null) continue;
    edits.push({ from: node.from, to: node.to, replacement: renderHashtag(renamed) });
  }

  // 2. Frontmatter tags — computed from the same parse, reading only the YAML
  // block's own `tags` value.
  const newFrontmatterTags = await renamedFrontmatterTags(tree, oldTag, newTag);

  // Apply inline edits to the body. (Frontmatter sits before every Hashtag, so
  // these splices never disturb the frontmatter region.)
  edits.sort((a, b) => b.from - a.from);
  let result = text;
  for (const e of edits) {
    result = result.slice(0, e.from) + e.replacement + result.slice(e.to);
  }

  // Apply the frontmatter tag change last, via the official patcher.
  if (newFrontmatterTags) {
    result = (await system.invokeFunction("index.patchFrontmatter", result, [
      { op: "set-key", path: "tags", value: newFrontmatterTags },
    ])) as string;
  }
  return result;
}

/**
 * Reads the `tags` value from the page's FrontMatter YAML block (only — no
 * inline tags) and returns the renamed, deduped tag array if any tag matched,
 * otherwise null (no frontmatter change needed).
 */
async function renamedFrontmatterTags(
  tree: ParseTree,
  oldTag: string,
  newTag: string,
): Promise<string[] | null> {
  const fm = collectNodesOfType(tree, "FrontMatter")[0];
  if (!fm) return null;
  // FrontMatter -> [marker, code]; the YAML text lives under children[1].
  const yamlText = renderToText(fm.children?.[1]).trim();
  if (!yamlText) return null;

  let parsed: { tags?: unknown };
  try {
    parsed = (await parseYaml(yamlText)) as { tags?: unknown };
  } catch {
    return null; // malformed YAML — leave it alone
  }
  const raw = parsed?.tags;
  if (raw === undefined || raw === null) return null;

  // Tags may be an array or a comma/space-separated string; SB also accepts a
  // leading `#` which it strips when indexing, so strip it here for matching.
  const current = (Array.isArray(raw)
    ? raw.map((t) => String(t))
    : String(raw).split(/,\s*|\s+/))
    .map((t) => t.replace(/^#/, ""))
    .filter(Boolean);

  let changed = false;
  const mapped = current.map((t) => {
    const renamed = matchTag(t, oldTag, newTag);
    if (renamed !== null) {
      changed = true;
      return renamed;
    }
    return t;
  });
  if (!changed) return null;

  // Dedupe (a rename can merge into an existing tag) while preserving order.
  return [...new Set(mapped)];
}

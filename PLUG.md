---
name: Library/josh-j/silverbullet-tagview/PLUG
tags: meta/library
version: 0.21.1
files:
  - treeview.plug.js
---

# TagView

A hierarchical, tag-based navigation panel for SilverBullet v2.

## Commands

| Command | Default key | Description |
|---------|-------------|-------------|
| `Tag Tree: Toggle` | `Ctrl/Cmd-Alt-B` | Show/hide the tag tree panel |
| `Tag Tree: Filter` | `Ctrl/Cmd-Alt-F` | Focus the tag/page filter (also `/` while the panel is focused) |
| `Tag Tree: Rename Tag` | — | Rename a tag everywhere it's used |
| `Tag Tree: Version` | — | Show the installed plug version |

Within the panel, use the ✎ button to rename a tag.

## Renaming tags

`Tag Tree: Rename Tag` (or the ✎ button in the panel header) renames a tag
across your whole space:

1. Pick the tag to rename — click a tag in the panel (it gets highlighted to
   show it's the target) and press ✎, or run the command and pick from the list.
2. Enter the new name.
3. Confirm the change (it shows how many files are affected).

It rewrites both inline `#hashtags` and frontmatter `tags:` entries, and renames
**hierarchical children** too — renaming `econ` → `economics` turns `#econ` into
`#economics` *and* `#econ/us` into `#economics/us`, while leaving unrelated tags
like `#economy` untouched.

## Configuration (optional)

The plug reads its settings from a `treeview` key on your `CONFIG` page (Space
Lua `config.set` works too). All keys are optional; defaults are shown.

```yaml
treeview:
  # Where the panel docks. One of: lhs | rhs | bhs | modal
  #   lhs   - left-hand side (default)
  #   rhs   - right-hand side
  #   bhs   - bottom
  #   modal - floating modal overlay
  position: lhs

  # Panel size as a CSS flex factor (must be a number > 0). Larger = wider/taller
  # relative to the editor. Default: 1
  size: 1
```

Invalid values are ignored (the default is used) and the plug flashes a
notification naming the offending key, so check the notification if a setting
doesn't seem to apply.

## Changelog

- **0.21.0** — Added a `.notag` listing, pinned to the top of the panel, that
  groups every page carrying no tags.
- **0.20.1** — Added resilient theme fallbacks so the tag panel keeps the correct
  dark background, text colors, controls, and root tag gutter on first render.
- **0.20.0** — Fixed tag row spacing by separating the root gutter from child
  indentation.
- **0.19.9** — Added a tag/page filter field and `/` filter hotkey.
- **0.19.8** — Direct pages now sort before child tags, with tighter child
  indentation.
- **0.19.7** — Tags start collapsed by default.
- **0.19.6** — Removed the alternate view UI and extra command; the panel is now
  tags-only.
- **0.19.5** — The tag clicked in the panel is now highlighted to show what the
  ✎ Rename button will act on.
- **0.19.4** — Rename-tag fixes: read only the YAML `tags:` block (no longer
  leaks inline tags into frontmatter), parse each page once, save the open page
  so the panel reflects it immediately, normalize the entered name, and let the
  panel ✎ button rename the last-clicked tag.
- **0.19.3** — Added `Tag Tree: Rename Tag` (command + panel ✎ button): renames a
  tag and its hierarchical children across the whole space, in both inline
  hashtags and frontmatter `tags:`.
- **0.19.2** — Added the `Tag Tree: Version` command.
- **0.19.1** — Migrated to SilverBullet v2 (Node/npm + `plug-compile`). Performance
  and architecture work: dropped Zod (~half the bundle), cached panel assets and
  the tag tree across navigation, HTML-escaped labels, debounced save refresh,
  render deduplication, and per-field config
  diagnostics.

> **Note:** bump `version:` above whenever `treeview.plug.js` changes — SilverBullet's
> `Library: Update` only detects updates from changes to this page's content, not
> from the `.plug.js` binary.

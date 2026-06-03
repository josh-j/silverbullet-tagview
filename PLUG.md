---
name: Library/josh-j/silverbullet-tagview/PLUG
tags: meta/library
version: 0.19.4
files:
  - treeview.plug.js
---

# TagView

A unified navigation panel for SilverBullet v2 with two view modes:

- **Tag Tree View** — a hierarchical, tag-based tree for navigating pages by tag.
- **Outline View** — all headers in the current page for quick in-page navigation.

## Commands

| Command | Default key | Description |
|---------|-------------|-------------|
| `Tag Tree: Toggle` | `Ctrl/Cmd-Alt-B` | Show/hide the panel in Tag Tree mode |
| `Outline: Toggle` | `Ctrl/Cmd-Alt-O` | Show/hide the panel in Outline mode |
| `Tag Tree: Rename Tag` | — | Rename a tag everywhere it's used |
| `Tag Tree: Version` | — | Show the installed plug version |

Within the panel, use the view-switcher buttons in the header to switch between
Tags and Outline modes, and the ✎ button (Tags view) to rename a tag.

## Renaming tags

`Tag Tree: Rename Tag` (or the ✎ button in the panel header) renames a tag
across your whole space:

1. Pick the tag to rename from the list.
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
  the tag tree across navigation, markdown-based outline parsing, HTML-escaped
  labels, debounced save refresh, render deduplication, and per-field config
  diagnostics.

> **Note:** bump `version:` above whenever `treeview.plug.js` changes — SilverBullet's
> `Library: Update` only detects updates from changes to this page's content, not
> from the `.plug.js` binary.

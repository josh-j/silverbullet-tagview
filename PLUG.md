---
name: Library/josh-j/silverbullet-tagview/PLUG
tags: meta/library
version: 0.19.1
files:
  - treeview.plug.js
---

# TagView

A unified navigation panel for SilverBullet v2 with two view modes:

- **Tag Tree View** — a hierarchical, tag-based tree for navigating pages by tag.
- **Outline View** — all headers in the current page for quick in-page navigation.

Toggle the panel with the **`Tag Tree: Toggle`** (`Ctrl/Cmd-Alt-B`) and
**`Outline: Toggle`** (`Ctrl/Cmd-Alt-O`) commands, and switch modes with the
view-switcher buttons in the panel header.

## Configuration (optional)

Add a `treeview` key to your `CONFIG` page to tune the panel:

```yaml
treeview:
  position: lhs   # lhs | rhs | bhs | modal
  size: 1
```

## Changelog

- **0.19.1** — Migrated to SilverBullet v2 (Node/npm + `plug-compile`). Performance
  and architecture work: dropped Zod (~half the bundle), cached panel assets and
  the tag tree across navigation, markdown-based outline parsing, HTML-escaped
  labels, debounced save refresh, render deduplication, and per-field config
  diagnostics.

> **Note:** bump `version:` above whenever `treeview.plug.js` changes — SilverBullet's
> `Library: Update` only detects updates from changes to this page's content, not
> from the `.plug.js` binary.

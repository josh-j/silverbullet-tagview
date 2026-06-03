---
name: Library/josh-j/TagView
tags: meta/library
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

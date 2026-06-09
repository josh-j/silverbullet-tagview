# assist.md

This file provides guidance to assist Code (assist.ai/code) when working with code in this repository.

## Project Overview

This is a SilverBullet plug that provides a hierarchical tag-based tree view for navigating pages by tags.

**Key Architecture:**
- `treeview.ts` - Main plug entry point with the tag tree panel (`showTreePanel()`)
- `api.ts` - Core data fetching: `getTagTree()` for tags
- `config.ts` - Configuration management and state management
- `assets/` - Contains UI assets (CSS, JS, SVG icons)
- `treeview.plug.yaml` - Plug manifest defining functions and events

## Development Commands

This plug targets **SilverBullet v2** and builds with Node/npm using the `plug-compile`
bin from the `@silverbulletmd/silverbullet` npm package (the Deno toolchain from v1 is gone).

**Install dependencies (first time):**
```shell
npm install
```

**Build the plug:**
```shell
npm run build
```

**Watch for changes and rebuild:**
```shell
npm run watch
```

**Debug build with per-function size info (unminified):**
```shell
npm run debug
```

**Install to a SilverBullet v2 space:**
In v2, plugs are distributed through a Library meta page rather than dropped into `_plug/`.
Place the compiled `treeview.plug.js` next to a `Library/.../*.md` meta page that lists it
under `files:`, then run the `Library: Install` / `Plugs: Reload` commands in SilverBullet.

## Core Data Flow

### Tag Tree View
1. **Tag Index Query**: Uses `index.queryLuaObjects("tag", {})` to fetch all tag entries
2. **Tree Building**: Processes tag paths (e.g., "project/frontend/react") into hierarchical structure
3. **Node Types**: Creates folder nodes for intermediate paths, tag nodes for leaf tags, and page nodes for tagged pages
4. **UI Rendering**: Displays tree with sortable-tree component, using folder icons for expand/collapse and chevron icons for nodes

## Key Functions

**Tag Panel:**
- `showTreePanel()` - Main function rendering the tag tree panel
- `toggleTree()` - Command: "Tag Tree: Toggle" (Ctrl+Alt+B / Cmd+Alt+B)
- `refreshTree()` - User-initiated refresh from the panel button

**Data Functions:**
- `getTagTree()` in api.ts:11 - Builds hierarchical tag structure from flat tag index

**Navigation:**
- Tag/page nodes use `editor.navigate(pageName)` for page navigation
- Expand/collapse icons (larger, 14px) handle folding without interfering with navigation

## Asset Dependencies

The plug requires external sortable-tree library files in `assets/sortable-tree/` which can be updated from:
- https://unpkg.com/sortable-tree/dist/sortable-tree.js  
- https://unpkg.com/sortable-tree/dist/sortable-tree.css

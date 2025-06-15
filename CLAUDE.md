# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a SilverBullet plug that provides two main navigation features:
1. **Tag Tree View**: Hierarchical tag-based tree view for navigating pages by tags
2. **Outline View**: Shows all headers in the current page for quick navigation

**Key Architecture:**
- `treeview.ts` - Main plug entry point with UI panel management for both views
- `api.ts` - Core data fetching: `getTagTree()` for tags, `getOutlineTree()` for headers
- `config.ts` - Configuration management with Zod validation and state management
- `assets/` - Contains UI assets (CSS, JS, SVG icons)
- `treeview.plug.yaml` - Plug manifest defining functions and events for both views

## Development Commands

**Build the plug:**
```shell
deno task build
```

**Watch for changes and rebuild:**
```shell
deno task watch
```

**Debug build with info:**
```shell
deno task debug
```

**Run tests:**
```shell
deno task test
```

**Build and install to SilverBullet space:**
```shell
deno task build && cp *.plug.js /path/to/space/_plug/
```

## Core Data Flow

### Tag Tree View
1. **Tag Index Query**: Uses `system.invokeFunction("index.queryLuaObjects", "tag", {})` to fetch all tag entries
2. **Tree Building**: Processes tag paths (e.g., "project/frontend/react") into hierarchical structure
3. **Node Types**: Creates folder nodes for intermediate paths, tag nodes for leaf tags, and page nodes for tagged pages
4. **UI Rendering**: Displays tree with sortable-tree component, using folder icons for expand/collapse and chevron icons for nodes

### Outline View
1. **Page Content**: Uses `editor.getText()` to get current page markdown content
2. **Header Parsing**: Regex matches headers (#{1,6}) and extracts level, title, and position
3. **Header Navigation**: Click handler uses `editor.moveCursor(pos)` to jump to header positions
4. **Visual Hierarchy**: CSS indentation based on header level (H1, H2, H3, etc.)

## Key Functions

**Tag Tree View:**
- `getTagTree()` in api.ts:11 - Builds hierarchical tag structure from flat tag index
- `showTree()` in treeview.ts:51 - Renders the tag tree view panel with all assets
- `toggleTree()` - Command: "Tag Tree: Toggle" (Ctrl+Alt+B / Cmd+Alt+B)

**Outline View:**
- `getOutlineTree()` in api.ts:112 - Extracts headers from current page content
- `showOutline()` in treeview.ts:165 - Renders the outline view panel
- `toggleOutline()` - Command: "Outline: Toggle" (Ctrl+Alt+O / Cmd+Alt+O)

**Shared:**
- Tree node sorting prioritizes folders/tags first, then pages, all alphabetically
- Header nodes use position-based navigation with `editor.moveCursor()`

## Asset Dependencies

The plug requires external sortable-tree library files in `assets/sortable-tree/` which can be updated from:
- https://unpkg.com/sortable-tree/dist/sortable-tree.js  
- https://unpkg.com/sortable-tree/dist/sortable-tree.css
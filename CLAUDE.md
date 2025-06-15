# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a SilverBullet plug that provides a unified navigation panel with two view modes:
1. **Tag Tree View**: Hierarchical tag-based tree view for navigating pages by tags
2. **Outline View**: Shows all headers in the current page for quick navigation

The panel includes view switcher buttons to toggle between modes within the same interface.

**Key Architecture:**
- `treeview.ts` - Main plug entry point with unified panel (`showUnifiedPanel()`) supporting both views
- `api.ts` - Core data fetching: `getTagTree()` for tags, `getOutlineTree()` for headers
- `config.ts` - Configuration management with Zod validation and state management
- `assets/` - Contains UI assets (CSS, JS, SVG icons) with view switcher styling
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
2. **Header Parsing**: Regex matches headers (#{1,6}) and extracts level, title, and character position
3. **Hierarchical Structure**: Headers are nested based on level (H1 contains H2-H6, H2 contains H3-H6, etc.)
4. **Header Navigation**: Click on leaf headers navigates using `editor.navigate(pageName@position)`
5. **Folding Support**: Click on headers with children toggles expand/collapse state
6. **Visual Hierarchy**: Bullet-based styling with distinct symbols for each header level
7. **Level-specific Bullets**: H1 (●), H2 (○), H3 (▪), H4 (▫), H5 (‣), H6 (‧) with progressive indentation

## Key Functions

**Unified Panel:**
- `showUnifiedPanel(viewType)` in treeview.ts:70 - Main function rendering either view mode
- `switchView(viewType)` - Switches between "tags" and "outline" modes
- `toggleTree()` - Command: "Tag Tree: Toggle" (Ctrl+Alt+B / Cmd+Alt+B) 
- `toggleOutline()` - Command: "Outline: Toggle" (Ctrl+Alt+O / Cmd+Alt+O)

**Data Functions:**
- `getTagTree()` in api.ts:11 - Builds hierarchical tag structure from flat tag index
- `getOutlineTree()` in api.ts:113 - Extracts headers and builds hierarchical tree with folding support

**Navigation:**
- Tag/page nodes use `editor.navigate(pageName)` for page navigation
- Header leaf nodes use `editor.navigate(pageName@position)` for proper scrolling to header positions
- Header parent nodes toggle expand/collapse when clicked (folding support)
- View switcher buttons in panel header for seamless mode switching between tags and outline

## Asset Dependencies

The plug requires external sortable-tree library files in `assets/sortable-tree/` which can be updated from:
- https://unpkg.com/sortable-tree/dist/sortable-tree.js  
- https://unpkg.com/sortable-tree/dist/sortable-tree.css
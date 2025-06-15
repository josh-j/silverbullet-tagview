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
2. **Header Parsing**: Regex matches headers (#{1,6}) and extracts level, title, and line number
3. **Header Navigation**: Click handler uses `editor.moveCursorToLine(lineNumber)` to jump to headers
4. **Visual Hierarchy**: CSS styling with font weight, size, and left border based on header level
5. **Level-specific Styling**: H1-H6 headers have distinct visual appearance (weight, size, opacity, italics)

## Key Functions

**Unified Panel:**
- `showUnifiedPanel(viewType)` in treeview.ts:70 - Main function rendering either view mode
- `switchView(viewType)` - Switches between "tags" and "outline" modes
- `toggleTree()` - Command: "Tag Tree: Toggle" (Ctrl+Alt+B / Cmd+Alt+B) 
- `toggleOutline()` - Command: "Outline: Toggle" (Ctrl+Alt+O / Cmd+Alt+O)

**Data Functions:**
- `getTagTree()` in api.ts:11 - Builds hierarchical tag structure from flat tag index
- `getOutlineTree()` in api.ts:113 - Extracts headers from current page content with line numbers

**Navigation:**
- Tag/page nodes use `editor.navigate(pageName)` for page navigation
- Header nodes use `editor.moveCursorToLine(lineNumber)` for precise positioning
- View switcher buttons in panel header for seamless mode switching

## Asset Dependencies

The plug requires external sortable-tree library files in `assets/sortable-tree/` which can be updated from:
- https://unpkg.com/sortable-tree/dist/sortable-tree.js  
- https://unpkg.com/sortable-tree/dist/sortable-tree.css
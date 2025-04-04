import { asset, editor, system } from "@silverbulletmd/silverbullet/syscalls";
import { getTagTree } from "./api.ts"; // Import getTagTree for hierarchical tags
import {
  getCustomStyles,
  isTreeViewEnabled,
  PLUG_DISPLAY_NAME,
  PLUG_NAME,
  Position,
  setTreeViewEnabled,
  TagTreeViewConfig, // Import config type for tags
} from "./config.ts";
import { getPlugConfig } from "./config.ts";

// Define the expected structure from index.queryObjects("tag",...)
// Make sure this is also defined or imported in api.ts if needed there
interface TagIndexEntry { name: string; page: string; [key: string]: any; }


let currentPosition: Position | undefined;

// --- toggleTree, hideTree, showTreeIfEnabled remain the same ---

export async function toggleTree() {
  const currentValue = await isTreeViewEnabled();
  if (!currentValue) {
    await showTree();
  } else {
    await hideTree();
  }
}

export async function hideTree() {
  if (currentPosition) {
    await editor.hidePanel(currentPosition);
    currentPosition = undefined;
    await setTreeViewEnabled(false);
  }
}

export async function showTreeIfEnabled() {
  try {
    const env = await system.getEnv();
    if (env === "server") { return; }
    if (await isTreeViewEnabled()) {
      return await showTree();
    }
  } catch (err) {
    console.error(`${PLUG_DISPLAY_NAME}: showTreeIfEnabled failed`, err);
  }
}

/**
 * Shows the hierarchical tag treeview and sets it to enabled.
 */
export async function showTree() {
  const config: TagTreeViewConfig = await getPlugConfig();

  if (currentPosition && config.position !== currentPosition) {
    await hideTree();
  }

  const [
    sortableTreeCss, sortableTreeJs, plugCss, plugJs,
    iconFolderMinus, iconFolderPlus, iconRefresh, iconXCircle,
  ] = await Promise.all([
    asset.readAsset(PLUG_NAME, "assets/sortable-tree/sortable-tree.css"),
    asset.readAsset(PLUG_NAME, "assets/sortable-tree/sortable-tree.js"),
    asset.readAsset(PLUG_NAME, "assets/treeview.css"),
    asset.readAsset(PLUG_NAME, "assets/treeview.js"),
    asset.readAsset(PLUG_NAME, "assets/icons/folder-minus.svg"),
    asset.readAsset(PLUG_NAME, "assets/icons/folder-plus.svg"),
    asset.readAsset(PLUG_NAME, "assets/icons/refresh-cw.svg"),
    asset.readAsset(PLUG_NAME, "assets/icons/x-circle.svg"),
  ]);

  const { nodes } = await getTagTree(config);
  const customStyles = await getCustomStyles();

  const treeViewJsConfig = {
    nodes,
    treeElementId: "treeview-tree",
    dragAndDrop: { enabled: false },
  };

  await editor.showPanel(
    config.position, config.size,
    // Panel HTML
    `
      <link rel="stylesheet" href="/.client/main.css" />
      <style>
        ${sortableTreeCss} ${plugCss}
        .tree__collapse { /* Ensure visible */ }
        .treeview-node-pagecount { font-size: 0.8em; margin-left: 6px; opacity: 0.7; display: inline-block; vertical-align: baseline; }
        .tree__label > span[data-node-type="folder"] {}
        ${customStyles ?? ""}
      </style>
      <div class="treeview-root">
        <div class="treeview-header">
          <div class="treeview-actions">
            <div class="treeview-actions-left">
              <button type="button" data-treeview-action="expand-all" title="Expand all">${iconFolderPlus}</button>
              <button type="button" data-treeview-action="collapse-all" title="Collapse all">${iconFolderMinus}</button>
              <button type="button" data-treeview-action="refresh" title="Refresh tags">${iconRefresh}</button>
            </div>
            <div class="treeview-actions-right">
              <button type="button" data-treeview-action="close-panel" title="Close tree">${iconXCircle}</button>
            </div>
          </div>
        </div>
        <div id="${treeViewJsConfig.treeElementId}"></div>
      </div>`,
    // Panel JavaScript (with debugging)
    `
      try {
        console.log("Panel JS: Loading SortableTree..."); ${sortableTreeJs} console.log("Panel JS: SortableTree loaded.");
        console.log("Panel JS: Loading plugJs (treeview.js)..."); ${plugJs} console.log("Panel JS: plugJs loaded.");
        console.log("Panel JS: Checking for initializeTreeViewPanel function...");
        if (typeof initializeTreeViewPanel === 'function') {
          console.log("Panel JS: Found initializeTreeViewPanel. Preparing config...");
          const treeViewPanelConfig = ${JSON.stringify(treeViewJsConfig)};
          console.log("Panel JS: Config prepared:", treeViewPanelConfig);
          console.log("Panel JS: Calling initializeTreeViewPanel...");
          initializeTreeViewPanel(treeViewPanelConfig);
          console.log("Panel JS: initializeTreeViewPanel finished.");
        } else {
          console.error("Panel JS: ERROR - initializeTreeViewPanel function not found!");
          const errorDiv = document.createElement('div'); errorDiv.style.color = 'red';
          errorDiv.textContent = 'Error: initializeTreeViewPanel function not found in assets/treeview.js!';
          document.body.prepend(errorDiv);
        }
      } catch (e) {
        console.error("Panel JS: ERROR executing panel script - ", e.name, e.message, e.stack);
        const errorDiv = document.createElement('div'); errorDiv.style.color = 'red';
        errorDiv.textContent = 'Error initializing panel script: ' + e.message + ' (See console for details)';
        document.body.prepend(errorDiv);
      }
    `
  );

  await setTreeViewEnabled(true);
  currentPosition = config.position;
}

// --- NEW FUNCTION ---
/**
 * Fetches a list of unique page names associated with a specific tag.
 * @param tagName The tag to search for.
 * @returns A promise resolving to an array of page names.
 */
export async function getPagesForTag(tagName: string): Promise<string[]> {
  if (!tagName) {
    console.warn("Backend: getPagesForTag called with empty tagName");
    return [];
  }
  console.log(`Backend: Fetching pages for tag: ${tagName}`);
  try {
    // Fetch all tag index entries
    const allTagEntries: TagIndexEntry[] = await system.invokeFunction(
      "index.queryObjects",
      "tag", // Query type
      {}     // No filters
    );

    // Filter entries for the specific tag and collect unique page names
    const pages = new Set<string>();
    for (const entry of allTagEntries) {
      // Ensure entry is valid and matches the requested tag name
      if (entry && entry.name === tagName && typeof entry.page === 'string' && entry.page) {
        pages.add(entry.page);
      }
    }

    // Convert Set to sorted array
    const pageList = Array.from(pages).sort();
    console.log(`Backend: Found ${pageList.length} pages for tag ${tagName}`);
    return pageList;

  } catch (e) {
    console.error(`Backend: Error fetching pages for tag ${tagName}:`, e);
    editor.flashNotification(`Error fetching pages for tag: ${e.message}`, "error");
    return []; // Return empty array on error
  }
}

// --- navigateToTagQuery function is NO LONGER NEEDED ---
// export async function navigateToTagQuery(tagName: string) { ... }

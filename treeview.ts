import { asset, editor, system } from "@silverbulletmd/silverbullet/syscalls";
import { getTagTree } from "./api.ts"; // Import getTagTree for hierarchical tags + pages
import {
  getCustomStyles,
  isTreeViewEnabled,
  PLUG_DISPLAY_NAME,
  PLUG_NAME,
  Position,
  setTreeViewEnabled,
  TagTreeViewConfig,
} from "./config.ts";
import { getPlugConfig } from "./config.ts";

// No longer needed: Define TagIndexEntry here if it's not exported/imported from api.ts
// interface TagIndexEntry { name: string; page: string; [key: string]: any; }

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
 * Shows the hierarchical tag treeview (with pages) and sets it to enabled.
 */
export async function showTree() {
  const config: TagTreeViewConfig = await getPlugConfig();

  if (currentPosition && config.position !== currentPosition) {
    await hideTree();
  }

  // Fetch necessary assets
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

  // Fetch the hierarchical tag tree data including pages
  const { nodes } = await getTagTree(config);
  const customStyles = await getCustomStyles();

  // Prepare config for the frontend JS
  const treeViewJsConfig = {
    nodes,
    treeElementId: "treeview-tree",
    dragAndDrop: { enabled: false },
  };

  // Show the panel
  await editor.showPanel(
    config.position, config.size,
    // Panel HTML
    `
      <link rel="stylesheet" href="/.client/main.css" />
      <style>
        ${sortableTreeCss}
        ${plugCss} /* Use the latest CSS from treeview_css_layout_fixes_v2 */
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
    // Panel JavaScript - Simplified, removed debug logs/try-catch
    `
      ${sortableTreeJs}
      ${plugJs}
      // Ensure initializeTreeViewPanel is defined in plugJs
      if (typeof initializeTreeViewPanel === 'function') {
        initializeTreeViewPanel(${JSON.stringify(treeViewJsConfig)});
      } else {
        console.error("Error: initializeTreeViewPanel is not defined!");
        // Optionally display an error message in the panel body
      }
    `
  );

  await setTreeViewEnabled(true);
  currentPosition = config.position;
}

// REMOVED getPagesForTag function - no longer needed
// REMOVED navigateToTagQuery function - no longer needed

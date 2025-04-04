import { asset, editor, system } from "@silverbulletmd/silverbullet/syscalls";
import { getTagTree } from "./api.ts"; // Using getTagTree for your plug
import {
  getCustomStyles,
  isTreeViewEnabled,
  PLUG_DISPLAY_NAME,
  PLUG_NAME,
  Position,
  setTreeViewEnabled,
  TagTreeViewConfig, // Assuming you still use TagTreeViewConfig
} from "./config.ts";
import { getPlugConfig } from "./config.ts";

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
 * Shows the hierarchical tag treeview, matching the example's appearance.
 */
export async function showTree() {
  const config: TagTreeViewConfig = await getPlugConfig(); // Use your config type

  if (currentPosition && config.position !== currentPosition) {
    await hideTree();
  }

  // Fetch necessary assets, including icons for header buttons
  const [
    sortableTreeCss,
    sortableTreeJs,
    plugCss, // Use treeview_css_final_appearance
    plugJs, // Use treeview_js_highlighting
    iconFolderMinus, // Icon for Collapse All
    iconFolderPlus, // Icon for Expand All
    iconNavigation2, // Icon for Reveal Current Page
    iconRefresh, // Icon for Refresh
    iconXCircle, // Icon for Close
    currentPage
  ] = await Promise.all([
    asset.readAsset(PLUG_NAME, "assets/sortable-tree/sortable-tree.css"),
    asset.readAsset(PLUG_NAME, "assets/sortable-tree/sortable-tree.js"),
    asset.readAsset(PLUG_NAME, "assets/treeview.css"), // Your updated CSS
    asset.readAsset(PLUG_NAME, "assets/treeview.js"), // Your updated JS
    asset.readAsset(PLUG_NAME, "assets/icons/folder-minus.svg"), // Load needed icon
    asset.readAsset(PLUG_NAME, "assets/icons/folder-plus.svg"), // Load needed icon
    asset.readAsset(PLUG_NAME, "assets/icons/navigation-2.svg"), // Load needed icon
    asset.readAsset(PLUG_NAME, "assets/icons/refresh-cw.svg"),
    asset.readAsset(PLUG_NAME, "assets/icons/x-circle.svg"),
    editor.getCurrentPage(),
  ]);

  // Fetch the hierarchical tag tree data
  const { nodes } = await getTagTree(config); // Use your API function
  const customStyles = await getCustomStyles();

  // Prepare config for the frontend JS
  const treeViewJsConfig = {
    nodes,
    currentPage, // Pass current page for highlighting
    treeElementId: "treeview-tree",
    // Keep D&D disabled for tag view unless you implement renaming logic
    dragAndDrop: {
      enabled: false,
      // confirmOnRename: config.dragAndDrop.confirmOnRename // Only if D&D enabled
    },
  };

  // Show the panel with header matching the example
  await editor.showPanel(
    config.position,
    config.size,
    // Panel HTML
    `
      <link rel="stylesheet" href="/.client/main.css" />
      <style>
        ${sortableTreeCss}
        ${plugCss} /* Use treeview_css_final_appearance */
        ${customStyles ?? ""}
      </style>
      <div class="treeview-root">
        <div class="treeview-header">
          <div class="treeview-actions">
            <div class="treeview-actions-left">
              <button type="button" data-treeview-action="expand-all" title="Expand all">${iconFolderPlus}</button>
              <button type="button" data-treeview-action="collapse-all" title="Collapse all">${iconFolderMinus}</button>
              <button type="button" data-treeview-action="reveal-current-page" title="Reveal current page">${iconNavigation2}</button>
              <button type="button" data-treeview-action="refresh" title="Refresh treeview">${iconRefresh}</button>
            </div>
            <div class="treeview-actions-right">
              <button type="button" data-treeview-action="close-panel" title="Close tree">${iconXCircle}</button>
            </div>
          </div>
        </div>
        <div id="${treeViewJsConfig.treeElementId}"></div>
      </div>`,
    // Panel JavaScript
    `
      ${sortableTreeJs}
      ${plugJs} // Use treeview_js_highlighting
      // Ensure initializeTreeViewPanel is defined and pass the config
      if (typeof initializeTreeViewPanel === 'function') {
        initializeTreeViewPanel(${JSON.stringify(treeViewJsConfig)});
      } else {
        console.error("Error: initializeTreeViewPanel is not defined!");
      }
    `,
  );

  await setTreeViewEnabled(true);
  currentPosition = config.position;
}

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
 * Shows the hierarchical tag treeview, loading node icons from SVG files.
 */
export async function showTree() {
  const config: TagTreeViewConfig = await getPlugConfig(); // Use your config type

  if (currentPosition && config.position !== currentPosition) {
    await hideTree();
  }

  // Fetch necessary assets, including node chevron SVG content
  try {
      const [
        // CSS and JS
        sortableTreeCss,
        sortableTreeJs,
        plugCss, // Should be treeview_css_chevron_icons content
        plugJs, // Should be treeview_js_chevron_icons content (or the updated one below)
        // Header Icons
        iconHeaderCollapse, // chevron-right for Collapse All button
        iconHeaderExpand,  // chevron-down for Expand All button
        iconNavigation2, // Icon for Reveal Current Page
        iconRefresh, // Icon for Refresh
        iconXCircle, // Icon for Close
        // Node Icons (Content loaded as strings)
        iconFolderCollapsed, // chevron-right SVG content for nodes
        iconFolderOpen,      // chevron-down SVG content for nodes
        // Data
        currentPage
      ] = await Promise.all([
        // Assets
        asset.readAsset(PLUG_NAME, "assets/sortable-tree/sortable-tree.css"),
        asset.readAsset(PLUG_NAME, "assets/sortable-tree/sortable-tree.js"),
        asset.readAsset(PLUG_NAME, "assets/treeview.css"),
        asset.readAsset(PLUG_NAME, "assets/treeview.js"),
        // Header Icons (SVGs for buttons)
        asset.readAsset(PLUG_NAME, "assets/icons/chevron-right.svg"),
        asset.readAsset(PLUG_NAME, "assets/icons/chevron-down.svg"),
        asset.readAsset(PLUG_NAME, "assets/icons/navigation-2.svg"),
        asset.readAsset(PLUG_NAME, "assets/icons/refresh-cw.svg"),
        asset.readAsset(PLUG_NAME, "assets/icons/x-circle.svg"),
        // Node Icons (Load SVG file *content*)
        asset.readAsset(PLUG_NAME, "assets/icons/chevron-right.svg"), // Load content
        asset.readAsset(PLUG_NAME, "assets/icons/chevron-down.svg"),  // Load content
        // Data
        editor.getCurrentPage(),
      ]);

      // Fetch the hierarchical tag tree data
      const { nodes } = await getTagTree(config); // Use your API function
      const customStyles = await getCustomStyles();

      const treeViewConfig = {
        nodes,
        currentPage,
        treeElementId: "treeview-tree",
        dragAndDrop: {
          ...config.dragAndDrop,
          enabled: config.dragAndDrop.enabled,
        },
      };

      await editor.showPanel(
        config.position,
        config.size,
        `
          <link rel="stylesheet" href="/.client/main.css" />
          <style>
            ${sortableTreeCss}
            ${plugCss}
            ${customStyles ?? ""}
          </style>
          <div class="treeview-root">
            <div class="treeview-header">
              <div class="treeview-actions">
                <div class="treeview-actions-left">
                  <button type="button" data-treeview-action="expand-all" title="Expand all">${iconHeaderExpand}</button>
                  <button type="button" data-treeview-action="collapse-all" title="Collapse all">${iconHeaderCollapse}</button>
                  <button type="button" data-treeview-action="reveal-current-page" title="Reveal current page">${iconNavigation2}</button>
                  <button type="button" data-treeview-action="refresh" title="Refresh treeview">${iconRefresh}</button>
                </div>
                <div class="treeview-actions-right">
                  <button type="button" data-treeview-action="close-panel" title="Close tree">${iconXCircle}</button>
                </div>
              </div>
            </div>
            <div id="${treeViewConfig.treeElementId}"></div>
          </div>`,
        `
          ${sortableTreeJs}
          ${plugJs}
          initializeTreeViewPanel(${JSON.stringify(TagTreeViewConfig)});
        `,
      );

      await setTreeViewEnabled(true);
      currentPosition = config.position;

  } catch (error) {
      console.error("Error loading assets or showing tree view:", error);
      editor.flashNotification(`Error loading tree view: ${error.message}`, "error");
      await hideTree();
  }
}

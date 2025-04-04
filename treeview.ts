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
 * Shows the hierarchical tag treeview with chevron icons in the header.
 */
export async function showTree() {
  const config: TagTreeViewConfig = await getPlugConfig(); // Use your config type

  if (currentPosition && config.position !== currentPosition) {
    await hideTree();
  }

  // Fetch necessary assets, ensuring all icons are loaded
  try {
      // *** CORRECTED Destructuring Syntax ***
      const [
        // CSS and JS first
        sortableTreeCss,  // No 'const' inside
        sortableTreeJs,
        plugCss,
        plugJs,
        // Icons
        iconChevronRight, // Use chevron-right for Collapse All
        iconChevronDown,  // Use chevron-down for Expand All
        iconNavigation2, // Icon for Reveal Current Page
        iconRefresh, // Icon for Refresh
        iconXCircle, // Icon for Close
        // Data
        currentPage
      ] = await Promise.all([
        // Assets
        asset.readAsset(PLUG_NAME, "assets/sortable-tree/sortable-tree.css"),
        asset.readAsset(PLUG_NAME, "assets/sortable-tree/sortable-tree.js"),
        asset.readAsset(PLUG_NAME, "assets/treeview.css"),
        asset.readAsset(PLUG_NAME, "assets/treeview.js"),
        // Icons (ensure paths are correct in your plug)
        asset.readAsset(PLUG_NAME, "assets/icons/chevron-right.svg"), // Load chevron-right
        asset.readAsset(PLUG_NAME, "assets/icons/chevron-down.svg"), // Load chevron-down
        asset.readAsset(PLUG_NAME, "assets/icons/navigation-2.svg"),
        asset.readAsset(PLUG_NAME, "assets/icons/refresh-cw.svg"),
        asset.readAsset(PLUG_NAME, "assets/icons/x-circle.svg"),
        // Data
        editor.getCurrentPage(),
      ]);
      // *** End of Correction ***

      // Fetch the hierarchical tag tree data
      const { nodes } = await getTagTree(config); // Use your API function
      const customStyles = await getCustomStyles();

      // Prepare config for the frontend JS
      const treeViewJsConfig = {
        nodes,
        currentPage, // Pass current page for highlighting
        treeElementId: "treeview-tree",
        // Keep D&D disabled for tag view
        dragAndDrop: {
          enabled: false,
        },
      };

      // Show the panel with header matching the example structure
      await editor.showPanel(
        config.position,
        config.size,
        // Panel HTML - Use chevron icons for expand/collapse buttons
        `
          <link rel="stylesheet" href="/.client/main.css" />
          <style>
            ${sortableTreeCss}
            ${plugCss} /* CSS matching the desired appearance */
            ${customStyles ?? ""}
          </style>
          <div class="treeview-root">
            <div class="treeview-header">
              <div class="treeview-actions">
                <div class="treeview-actions-left">
                  <button type="button" data-treeview-action="expand-all" title="Expand all">${iconChevronDown}</button>
                  <button type="button" data-treeview-action="collapse-all" title="Collapse all">${iconChevronRight}</button>
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
          ${plugJs} // JS with highlighting and reveal action
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

  } catch (error) {
      console.error("Error loading assets or showing tree view:", error);
      // Optionally show a notification to the user
      editor.flashNotification(`Error loading tree view: ${error.message}`, "error");
      // Ensure state is consistent if panel failed to show
      await hideTree();
  }
}

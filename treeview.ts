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
 * Shows the hierarchical tag treeview with folder icons for header buttons
 * and chevron icons for nodes.
 */
export async function showTree() {
  const config: TagTreeViewConfig = await getPlugConfig(); // Use your config type

  if (currentPosition && config.position !== currentPosition) {
    await hideTree();
  }

  // Fetch necessary assets, loading the correct icons
  try {
      const [
        // CSS and JS
        sortableTreeCss,
        sortableTreeJs,
        plugCss, // Should be treeview_css_final content
        plugJs, // Should be treeview_js_final content
        // Header Icons (Folder +/-)
        iconHeaderCollapse, // Use folder-minus for Collapse All button
        iconHeaderExpand,   // Use folder-plus for Expand All button
        // Other Header Icons
        iconNavigation2, // Icon for Reveal Current Page
        iconRefresh, // Icon for Refresh
        iconXCircle, // Icon for Close
        // Node Icons (Chevrons - Content loaded as strings)
        nodeIconCollapsedSvg, // chevron-right SVG content for nodes
        nodeIconOpenSvg,      // chevron-down SVG content for nodes
        // Data
        currentPage
      ] = await Promise.all([
        // Assets
        asset.readAsset(PLUG_NAME, "assets/sortable-tree/sortable-tree.css"),
        asset.readAsset(PLUG_NAME, "assets/sortable-tree/sortable-tree.js"),
        asset.readAsset(PLUG_NAME, "assets/treeview.css"),
        asset.readAsset(PLUG_NAME, "assets/treeview.js"),
        // Header Icons (Load folder icons)
        asset.readAsset(PLUG_NAME, "assets/icons/folder-minus.svg"), // Load folder-minus
        asset.readAsset(PLUG_NAME, "assets/icons/folder-plus.svg"),  // Load folder-plus
        asset.readAsset(PLUG_NAME, "assets/icons/navigation-2.svg"),
        asset.readAsset(PLUG_NAME, "assets/icons/refresh-cw.svg"),
        asset.readAsset(PLUG_NAME, "assets/icons/x-circle.svg"),
        // Node Icons (Load chevron SVG file *content*)
        asset.readAsset(PLUG_NAME, "assets/icons/chevron-right.svg"), // Load chevron-right content
        asset.readAsset(PLUG_NAME, "assets/icons/chevron-down.svg"),  // Load chevron-down content
        // Data
        editor.getCurrentPage(),
      ]);

      // Fetch the hierarchical tag tree data
      const { nodes } = await getTagTree(config); // Use your API function
      const customStyles = await getCustomStyles();

      // Prepare config for the frontend JS, including node icon SVG content
      const treeViewJsConfig = {
        nodes,
        currentPage, // Pass current page for highlighting
        treeElementId: "treeview-tree",
        dragAndDrop: { enabled: false }, // Keep D&D disabled
        // Pass SVG content for node icons
        nodeIcons: {
            collapsed: nodeIconCollapsedSvg, // Pass chevron-right content
            open: nodeIconOpenSvg           // Pass chevron-down content
        }
      };

      // Show the panel with header matching the example structure
      await editor.showPanel(
        config.position,
        config.size,
        // Panel HTML - Use FOLDER icons for expand/collapse buttons
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
            <div id="${treeViewJsConfig.treeElementId}"></div>
          </div>`,
        // Panel JavaScript
        `
          ${sortableTreeJs}
          ${plugJs} // JS using passed icons and handling actions
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
      editor.flashNotification(`Error loading tree view: ${error.message}`, "error");
      await hideTree();
  }
}

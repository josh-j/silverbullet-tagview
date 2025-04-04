import { asset, editor, system } from "@silverbulletmd/silverbullet/syscalls";
// Assuming getTagTree fetches the hierarchical tag structure
import { getTagTree } from "./api.ts";
import {
  getCustomStyles,
  isTreeViewEnabled,
  PLUG_DISPLAY_NAME,
  PLUG_NAME,
  Position,
  setTreeViewEnabled,
  // Import TagTreeViewConfig as a TYPE
  type TagTreeViewConfig,
  getPlugConfig, // Import the function to get config
} from "./config.ts";

// Keep track of the current panel position
let currentPosition: Position | undefined;

// --- toggleTree, hideTree remain the same ---

export async function toggleTree() {
  const currentValue = await isTreeViewEnabled();
  if (!currentValue) {
    // Pass initial config when showing for the first time via toggle
    await showTree();
  } else {
    await hideTree();
  }
}

export async function hideTree() {
  if (currentPosition) {
    // Use the stored position to hide the correct panel
    await editor.hidePanel(currentPosition);
    currentPosition = undefined; // Clear position when hidden
    await setTreeViewEnabled(false);
  }
}

// --- showTreeIfEnabled remains the same ---
export async function showTreeIfEnabled() {
  try {
    const env = await system.getEnv();
    // Don't show the panel on the server
    if (env === "server") {
      return;
    }
    if (await isTreeViewEnabled()) {
      // Pass potentially updated config if shown automatically on load
      return await showTree();
    }
  } catch (err) {
    console.error(`${PLUG_DISPLAY_NAME}: showTreeIfEnabled failed`, err);
    // Optionally notify the user
    // editor.flashNotification(`${PLUG_DISPLAY_NAME}: Failed to auto-show tree.`, "error");
  }
}

/**
 * Shows the hierarchical tag treeview, loading necessary assets and data.
 */
export async function showTree() {
  // Fetch the latest configuration each time the tree is shown
  const config: TagTreeViewConfig = await getPlugConfig();

  // If the panel exists but the configured position changed, hide the old one first
  if (currentPosition && config.position !== currentPosition) {
    await hideTree();
  }

  // Fetch necessary assets (CSS, JS, Icons) and data concurrently
  try {
    const [
      // CSS and JS for the sortable tree library
      sortableTreeCss,
      sortableTreeJs,
      // Custom CSS and JS for the plug's panel behavior
      plugCss, // Should contain styles for treeview-root, treeview-header, etc.
      plugJs, // Should contain initializeTreeViewPanel, createTreeView etc.
      // Header Icons (Load SVG content as strings)
      // Using chevron-down for Expand All, chevron-right for Collapse All
      iconHeaderExpand, // SVG content for Expand All button
      iconHeaderCollapse, // SVG content for Collapse All button
      iconNavigation2, // SVG content for Reveal Current Page button
      iconRefresh, // SVG content for Refresh button
      iconXCircle, // SVG content for Close button
      // Node Icons (Load SVG content as strings) - For expand/collapse arrows on nodes
      iconFolderOpen, // SVG content for open folder/tag node (e.g., chevron-down)
      iconFolderCollapsed, // SVG content for closed folder/tag node (e.g., chevron-right)
      // Data
      currentPage, // Get the current page name
      { nodes }, // Fetch the hierarchical tag tree data using the API
      customStyles, // Fetch custom UI styles defined by the user
    ] = await Promise.all([
      // Assets
      asset.readAsset(PLUG_NAME, "assets/sortable-tree/sortable-tree.css"),
      asset.readAsset(PLUG_NAME, "assets/sortable-tree/sortable-tree.js"),
      asset.readAsset(PLUG_NAME, "assets/treeview.css"), // Your custom panel CSS
      asset.readAsset(PLUG_NAME, "assets/treeview.js"), // Your custom panel JS
      // Header Icons (SVGs for buttons)
      asset.readAsset(PLUG_NAME, "assets/icons/chevron-down.svg"), // Expand All
      asset.readAsset(PLUG_NAME, "assets/icons/chevron-right.svg"), // Collapse All
      asset.readAsset(PLUG_NAME, "assets/icons/navigation-2.svg"), // Reveal
      asset.readAsset(PLUG_NAME, "assets/icons/refresh-cw.svg"), // Refresh
      asset.readAsset(PLUG_NAME, "assets/icons/x-circle.svg"), // Close
      // Node Icons (Load SVG file *content*)
      asset.readAsset(PLUG_NAME, "assets/icons/chevron-down.svg"), // Open Node
      asset.readAsset(PLUG_NAME, "assets/icons/chevron-right.svg"), // Collapsed Node
      // Data / Settings
      editor.getCurrentPage(),
      getTagTree(config), // Fetch tag nodes using your API function
      getCustomStyles(),
    ]);

    // --- FIX: Construct the configuration object to pass to the panel's JavaScript ---
    // This object will be serialized and used by initializeTreeViewPanel in plugJs
    const treeViewConfig = {
      nodes, // The actual tag tree data
      currentPage, // Current page name for highlighting/revealing
      treeElementId: "treeview-tree", // ID of the div where the tree will be rendered
      // --- FIX: Explicitly set dragAndDrop config as it's disabled for tags ---
      dragAndDrop: {
        enabled: false, // D&D is not applicable/enabled for tags
        // Remove confirmOnRename or other D&D specific options if they were here
      },
      // --- FIX: Pass loaded SVG content for node icons ---
      // NOTE: Your createTreeView function (in treeview.js/plugJs) MUST be updated
      //       to accept and use these icons from the config object.
      icons: {
        nodeIconOpenSvg: iconFolderOpen, // chevron-down SVG content
        nodeIconCollapsedSvg: iconFolderCollapsed, // chevron-right SVG content
      },
    };

    // Show the panel using the configured position and size
    await editor.showPanel(
      config.position,
      config.size,
      // --- Panel HTML Structure ---
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
                <button type="button" data-treeview-action="reveal-current-page" title="Reveal current page/tag">${iconNavigation2}</button>
                <button type="button" data-treeview-action="refresh" title="Refresh treeview">${iconRefresh}</button>
              </div>
              <div class="treeview-actions-right">
                <button type="button" data-treeview-action="close-panel" title="Close tree">${iconXCircle}</button>
              </div>
            </div>
          </div>
          <div id="${treeViewConfig.treeElementId}"></div>
        </div>
      `,
      // --- Panel JavaScript ---
      `
        // Inject JS: Sortable Tree Library + Custom Plug Logic
        ${sortableTreeJs}
        ${plugJs}
        // --- FIX: Initialize the panel JS with the correctly structured and stringified 'treeViewConfig' VARIABLE ---
        initializeTreeViewPanel(${JSON.stringify(treeViewConfig)});
      `,
    );

    // Successfully shown, update state
    await setTreeViewEnabled(true);
    currentPosition = config.position; // Store the position used

  } catch (error) {
    // Log the detailed error for debugging
    console.error("Error loading assets or showing tree view:", error);
    // Notify the user that something went wrong
    editor.flashNotification(
      `${PLUG_DISPLAY_NAME}: Error showing tree view. Check console (Ctrl+Shift+J or Cmd+Opt+J) for details.`,
      "error",
    );
    // Attempt to hide any potentially broken panel state
    await hideTree();
  }
}

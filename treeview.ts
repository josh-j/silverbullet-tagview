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


let currentPosition: Position | undefined;

// toggleTree, hideTree, showTreeIfEnabled remain largely the same conceptually

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
    if (env === "server") {
      // Don't show UI elements on the server
      return;
    }
    if (await isTreeViewEnabled()) {
      return await showTree();
    }
  } catch (err) {
    console.error(`${PLUG_DISPLAY_NAME}: showTreeIfEnabled failed`, err);
  }
}


// Add this function inside treeview.ts
export async function navigateToTagQuery(tagName: string) {
  if (tagName) {
    // This function runs in the main plug context and CAN use editor.runCommand
    console.log(`Backend: Received request to navigate to tag: ${tagName}`);
    await editor.runCommand("query.set", `tag:${tagName}`);
  } else {
    console.warn("Backend: navigateToTagQuery called with empty tagName");
  }
}

/**
 * Shows the hierarchical tag treeview and sets it to enabled.
 */
export async function showTree() {
  const config: TagTreeViewConfig = await getPlugConfig();

  // Hide previous panel if position preference changed
  if (currentPosition && config.position !== currentPosition) {
    await hideTree();
  }

  // Fetch necessary assets including folder icons for expand/collapse buttons
  const [
    sortableTreeCss,
    sortableTreeJs,
    plugCss,
    plugJs,
    iconFolderMinus, // Load collapse icon
    iconFolderPlus,  // Load expand icon
    iconRefresh,
    iconXCircle,
  ] = await Promise.all([
    asset.readAsset(PLUG_NAME, "assets/sortable-tree/sortable-tree.css"),
    asset.readAsset(PLUG_NAME, "assets/sortable-tree/sortable-tree.js"),
    asset.readAsset(PLUG_NAME, "assets/treeview.css"),
    asset.readAsset(PLUG_NAME, "assets/treeview.js"),
    asset.readAsset(PLUG_NAME, "assets/icons/folder-minus.svg"), // Path to collapse icon
    asset.readAsset(PLUG_NAME, "assets/icons/folder-plus.svg"),   // Path to expand icon
    asset.readAsset(PLUG_NAME, "assets/icons/refresh-cw.svg"),
    asset.readAsset(PLUG_NAME, "assets/icons/x-circle.svg"),
  ]);

  // Fetch the hierarchical tag tree data using the updated getTagTree
  const { nodes } = await getTagTree(config);
  const customStyles = await getCustomStyles();

  // Prepare config for the frontend JS (treeview.js)
  const treeViewJsConfig = {
    nodes, // Pass the hierarchical tag nodes
    treeElementId: "treeview-tree",
    dragAndDrop: { // Ensure D&D remains disabled
      enabled: false,
    },
  };

  // Show the panel with updated HTML including expand/collapse buttons
  await editor.showPanel(
    config.position,
    config.size,
    // Panel HTML - includes expand/collapse buttons
    `
      <link rel="stylesheet" href="/.client/main.css" />
      <style>
        ${sortableTreeCss}
        ${plugCss}
        /* Ensure CSS for hierarchy (e.g., collapse icon visibility) is correct */
        .tree__collapse { /* Ensure this is NOT set to display: none */ }
        .treeview-node-pagecount { font-size: 0.8em; margin-left: 6px; opacity: 0.7; display: inline-block; vertical-align: baseline; }
        .tree__label > span[data-node-type="folder"] { /* Optional folder styles */ }
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
    // Panel JavaScript with added debugging and error handling
    `
      try {
        console.log("Panel JS: Loading SortableTree...");
        ${sortableTreeJs}
        console.log("Panel JS: SortableTree loaded.");

        console.log("Panel JS: Loading plugJs (treeview.js)...");
        ${plugJs}
        console.log("Panel JS: plugJs loaded.");

        console.log("Panel JS: Checking for initializeTreeViewPanel function...");
        if (typeof initializeTreeViewPanel === 'function') {
          console.log("Panel JS: Found initializeTreeViewPanel. Preparing config...");
          // Use a variable for clarity and easier debugging in console
          const treeViewPanelConfig = ${JSON.stringify(treeViewJsConfig)};
          console.log("Panel JS: Config prepared:", treeViewPanelConfig);
          console.log("Panel JS: Calling initializeTreeViewPanel...");
          initializeTreeViewPanel(treeViewPanelConfig);
          console.log("Panel JS: initializeTreeViewPanel finished.");
        } else {
          console.error("Panel JS: ERROR - initializeTreeViewPanel function not found!");
          // Display error in panel
          const errorDiv = document.createElement('div');
          errorDiv.style.color = 'red';
          errorDiv.textContent = 'Error: initializeTreeViewPanel function not found in assets/treeview.js!';
          document.body.prepend(errorDiv);
        }
      } catch (e) {
        console.error("Panel JS: ERROR executing panel script - ", e.name, e.message, e.stack);
        // Display error in the panel itself
        const errorDiv = document.createElement('div');
        errorDiv.style.color = 'red';
        errorDiv.textContent = 'Error initializing panel script: ' + e.message + ' (See console for details)';
        document.body.prepend(errorDiv);
      }
    `
  );

  // Update state
  await setTreeViewEnabled(true);
  currentPosition = config.position;
}

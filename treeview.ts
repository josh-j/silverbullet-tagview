// ... imports (make sure to import TagTreeViewConfig, getTagTree)
import { asset, editor, system } from "@silverbulletmd/silverbullet/syscalls";
import { getTagTree } from "./api.ts"; // Import getTagTree
import {
  getCustomStyles,
  isTreeViewEnabled,
  PLUG_DISPLAY_NAME,
  PLUG_NAME,
  Position,
  setTreeViewEnabled,
  TagTreeViewConfig, // Import new config type
} from "./config.ts";
// import { supportsPageRenaming } from "./compatability.ts"; // Likely not needed for tags
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
      return;
    }
    if (await isTreeViewEnabled()) {
      return await showTree();
    }
  } catch (err) {
    console.error(`${PLUG_DISPLAY_NAME}: showTreeIfEnabled failed`, err);
  }
}


/**
 * Shows the tag treeview and sets it to enabled.
 */
export async function showTree() {
  const config: TagTreeViewConfig = await getPlugConfig(); // Use updated config getter

  if (currentPosition && config.position !== currentPosition) {
    await hideTree();
  }

  // Fetch necessary assets - remove unused icons if needed
  const [
    sortableTreeCss,
    sortableTreeJs, // Note: sortable-tree.js might need adjustments if D&D is fully removed/handled differently client-side
    plugCss,
    plugJs, // Note: plugJs (assets/treeview.js) needs significant changes
    // iconFolderMinus, // Remove folder icons if not used
    // iconFolderPlus,
    // iconNavigation2, // Remove reveal page icon
    iconRefresh,
    iconXCircle,
    // Maybe add a tag icon?
    // iconTag,
  ] = await Promise.all([
    asset.readAsset(PLUG_NAME, "assets/sortable-tree/sortable-tree.css"),
    asset.readAsset(PLUG_NAME, "assets/sortable-tree/sortable-tree.js"),
    asset.readAsset(PLUG_NAME, "assets/treeview.css"), // May need CSS tweaks for tags
    asset.readAsset(PLUG_NAME, "assets/treeview.js"), // THIS WILL NEED UPDATING
    // asset.readAsset(PLUG_NAME, "assets/icons/folder-minus.svg"),
    // asset.readAsset(PLUG_NAME, "assets/icons/folder-plus.svg"),
    // asset.readAsset(PLUG_NAME, "assets/icons/navigation-2.svg"),
    asset.readAsset(PLUG_NAME, "assets/icons/refresh-cw.svg"),
    asset.readAsset(PLUG_NAME, "assets/icons/x-circle.svg"),
    // asset.readAsset(PLUG_NAME, "assets/icons/tag.svg"), // Example if adding tag icon
  ]);

  // Fetch the tag tree data
  const { nodes /* remove currentPage */ } = await getTagTree(config);
  const customStyles = await getCustomStyles();

  // Prepare config for the frontend JS
  const treeViewJsConfig = {
    nodes, // Pass the tag nodes
    // currentPage: undefined, // No current page concept here
    treeElementId: "treeview-tree",
    dragAndDrop: { // Explicitly disable D&D for tags
      enabled: false,
      // confirmOnRename: false, // Not applicable
    },
    // Add any other options needed by the updated treeview.js
  };

  // Update the HTML structure for the panel
  await editor.showPanel(
    config.position,
    config.size,
    `
      <link rel="stylesheet" href="/.client/main.css" />
      <style>
        ${sortableTreeCss}
        ${plugCss}
        /* Add specific styles for tags if needed */
        .st-node[data-node-type="tag"]::before {
          /* Example: add a specific icon or style for tag nodes */
          /* content: url("data:image/svg+xml,..."); */
        }
        .treeview-node-pagecount { /* Style for page count */
            font-size: 0.8em;
            margin-left: 5px;
            opacity: 0.7;
        }
        ${customStyles ?? ""}
      </style>
      <div class="treeview-root">
        <div class="treeview-header">
          <div class="treeview-actions">
            <div class="treeview-actions-left">
              <button type="button" data-treeview-action="refresh" title="Refresh tags">${iconRefresh}</button>
            </div>
            <div class="treeview-actions-right">
              <button type="button" data-treeview-action="close-panel" title="Close tree">${iconXCircle}</button>
            </div>
          </div>
        </div>
        <div id="${treeViewJsConfig.treeElementId}"></div>
      </div>`,
    // Update the JS payload
    `
      ${sortableTreeJs}
      ${plugJs}
      // Pass the modified config, ensure initializeTreeViewPanel function in treeview.js
      // is adapted to handle tag nodes and lack of D&D/currentPage.
      // It should likely attach click handlers to tag nodes that trigger searches.
      initializeTreeViewPanel(${JSON.stringify(treeViewJsConfig)});
    `,
  );

  await setTreeViewEnabled(true);
  currentPosition = config.position;
}

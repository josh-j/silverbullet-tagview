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
    iconRefresh, iconXCircle,
    currentPage // *** Get current page name ***
  ] = await Promise.all([
    asset.readAsset(PLUG_NAME, "assets/sortable-tree/sortable-tree.css"),
    asset.readAsset(PLUG_NAME, "assets/sortable-tree/sortable-tree.js"),
    asset.readAsset(PLUG_NAME, "assets/treeview.css"), // Use the latest CSS
    asset.readAsset(PLUG_NAME, "assets/treeview.js"), // Use the latest JS
    asset.readAsset(PLUG_NAME, "assets/icons/refresh-cw.svg"),
    asset.readAsset(PLUG_NAME, "assets/icons/x-circle.svg"),
    editor.getCurrentPage(), // *** Get current page syscall ***
  ]);

  // Fetch the hierarchical tag tree data including pages
  const { nodes } = await getTagTree(config);
  const customStyles = await getCustomStyles();

  // Prepare config for the frontend JS
  const treeViewJsConfig = {
    nodes,
    treeElementId: "treeview-tree",
    dragAndDrop: { enabled: false },
    currentPage: currentPage, // *** Add currentPage to config ***
  };

  // Define header buttons (using text placeholders or other icons)
  const expandAllButton = `<button type="button" data-treeview-action="expand-all" title="Expand all">[+]</button>`;
  const collapseAllButton = `<button type="button" data-treeview-action="collapse-all" title="Collapse all">[-]</button>`;


  // Show the panel
  await editor.showPanel(
    config.position, config.size,
    // Panel HTML
    `
      <link rel="stylesheet" href="/.client/main.css" />
      <style>
        ${sortableTreeCss}
        ${plugCss} /* Use the LATEST modified CSS */
        ${customStyles ?? ""}
      </style>
      <div class="treeview-root">
        <div class="treeview-header">
          <div class="treeview-actions">
            <div class="treeview-actions-left">
              ${expandAllButton}
              ${collapseAllButton}
              <button type="button" data-treeview-action="refresh" title="Refresh tags">${iconRefresh}</button>
            </div>
            <div class="treeview-actions-right">
              <button type="button" data-treeview-action="close-panel" title="Close tree">${iconXCircle}</button>
            </div>
          </div>
        </div>
        <div id="${treeViewJsConfig.treeElementId}"></div>
      </div>`,
    // Panel JavaScript - Use LATEST modified JS
    `
      ${sortableTreeJs}
      ${plugJs}
      // Ensure initializeTreeViewPanel is defined in plugJs
      if (typeof initializeTreeViewPanel === 'function') {
        // Pass the config including currentPage
        initializeTreeViewPanel(${JSON.stringify(treeViewJsConfig)});
      } else {
        console.error("Error: initializeTreeViewPanel is not defined!");
      }
    `
  );

  await setTreeViewEnabled(true);
  currentPosition = config.position;
}

// ... rest of the file

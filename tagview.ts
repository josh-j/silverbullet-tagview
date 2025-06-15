import { asset, editor, system } from "@silverbulletmd/silverbullet/syscalls";
import { getTagTree } from "./api.ts"; // Using getTagTree for your plug
import {
  getCustomStyles,
  isTagViewEnabled,
  PLUG_DISPLAY_NAME,
  PLUG_NAME,
  Position,
  setTagViewEnabled,
  TagViewConfig as TagTreeViewConfig, // Assuming you still use TagTreeViewConfig
} from "./config.ts";
import { getPlugConfig } from "./config.ts";

let currentPosition: Position | undefined;

// --- toggleTree, hideTree, showTreeIfEnabled remain the same ---

export async function toggleTagView() {
  const currentValue = await isTagViewEnabled();
  if (!currentValue) {
    await showTagView();
  } else {
    await hideTagView();
  }
}

export async function hideTagView() {
  if (currentPosition) {
    await editor.hidePanel(currentPosition);
    currentPosition = undefined;
    await setTagViewEnabled(false);
  }
}

export async function showTagViewIfEnabled() {
  try {
    const env = await system.getEnv();
    if (env === "server") { return; }
    if (await isTagViewEnabled()) {
      return await showTagView();
    }
  } catch (err) {
    console.error(`${PLUG_DISPLAY_NAME}: showTagViewIfEnabled failed`, err);
  }
}

/**
 * Shows the hierarchical tag treeview with folder icons for header buttons
 * and chevron icons for nodes.
 */
export async function showTagView() {
  const config: TagTreeViewConfig = await getPlugConfig(); // Use your config type

  if (currentPosition && config.position !== currentPosition) {
    await hideTagView();
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
        asset.readAsset(PLUG_NAME, "assets/tagview.css"),
        asset.readAsset(PLUG_NAME, "assets/tagview.js"),
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
      const tagViewJsConfig = {
        nodes,
        currentPage, // Pass current page for highlighting
        treeElementId: "tagview-tree",
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
          <div class="tagview-root">
            <div class="tagview-header">
              <div class="tagview-actions">
                <div class="tagview-actions-left">
                  <button type="button" data-tagview-action="expand-all" title="Expand all">${iconHeaderExpand}</button>
                  <button type="button" data-tagview-action="collapse-all" title="Collapse all">${iconHeaderCollapse}</button>
                  <button type="button" data-tagview-action="reveal-current-page" title="Reveal current page">${iconNavigation2}</button>
                  <button type="button" data-tagview-action="refresh" title="Refresh tag view">${iconRefresh}</button>
                </div>
                <div class="tagview-actions-right">
                  <button type="button" data-tagview-action="close-panel" title="Close tag view">${iconXCircle}</button>
                </div>
              </div>
            </div>
            <div id="${tagViewJsConfig.treeElementId}"></div>
          </div>`,
        // Panel JavaScript
        `
          ${sortableTreeJs}
          ${plugJs} // JS using passed icons and handling actions
          // Ensure initializeTreeViewPanel is defined and pass the config
          if (typeof initializeTagViewPanel === 'function') {
            initializeTagViewPanel(${JSON.stringify(tagViewJsConfig)});
          } else {
            console.error("Error: initializeTagViewPanel is not defined!");
          }
        `,
      );

      await setTagViewEnabled(true);
      currentPosition = config.position;

  } catch (error) {
      console.error("Error loading assets or showing tag view:", error);
      editor.flashNotification(`Error loading tag view: ${error.message}`, "error");
      await hideTagView();
  }
}

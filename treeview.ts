import { asset, editor } from "@silverbulletmd/silverbullet/syscalls";
import { getTagTree, getOutlineTree } from "./api.ts";
import {
  getCustomStyles,
  getLastView,
  isTreeViewEnabled,
  PLUG_DISPLAY_NAME,
  PLUG_NAME,
  Position,
  setLastView,
  setTreeViewEnabled,
  TagTreeViewConfig,
  ViewType,
} from "./config.ts";
import { getPlugConfig } from "./config.ts";

let currentPosition: Position | undefined;

/**
 * Static panel assets (CSS/JS/SVG icons) never change at runtime, so they are
 * read from the bundle once and cached. Without this, every page load/save
 * re-read all 11 assets before re-rendering the panel.
 */
interface PanelAssets {
  sortableTreeCss: string;
  sortableTreeJs: string;
  plugCss: string;
  plugJs: string;
  iconHeaderCollapse: string;
  iconHeaderExpand: string;
  iconNavigation2: string;
  iconRefresh: string;
  iconXCircle: string;
  nodeIconCollapsedSvg: string;
  nodeIconOpenSvg: string;
}

let cachedAssets: PanelAssets | undefined;

async function loadAssets(): Promise<PanelAssets> {
  if (cachedAssets) return cachedAssets;
  const [
    sortableTreeCss,
    sortableTreeJs,
    plugCss,
    plugJs,
    iconHeaderCollapse,
    iconHeaderExpand,
    iconNavigation2,
    iconRefresh,
    iconXCircle,
    nodeIconCollapsedSvg,
    nodeIconOpenSvg,
  ] = await Promise.all([
    asset.readAsset(PLUG_NAME, "assets/sortable-tree/sortable-tree.css"),
    asset.readAsset(PLUG_NAME, "assets/sortable-tree/sortable-tree.js"),
    asset.readAsset(PLUG_NAME, "assets/treeview.css"),
    asset.readAsset(PLUG_NAME, "assets/treeview.js"),
    asset.readAsset(PLUG_NAME, "assets/icons/folder-minus.svg"),
    asset.readAsset(PLUG_NAME, "assets/icons/folder-plus.svg"),
    asset.readAsset(PLUG_NAME, "assets/icons/navigation-2.svg"),
    asset.readAsset(PLUG_NAME, "assets/icons/refresh-cw.svg"),
    asset.readAsset(PLUG_NAME, "assets/icons/x-circle.svg"),
    asset.readAsset(PLUG_NAME, "assets/icons/chevron-right.svg"),
    asset.readAsset(PLUG_NAME, "assets/icons/chevron-down.svg"),
  ]);
  cachedAssets = {
    sortableTreeCss, sortableTreeJs, plugCss, plugJs,
    iconHeaderCollapse, iconHeaderExpand, iconNavigation2, iconRefresh,
    iconXCircle, nodeIconCollapsedSvg, nodeIconOpenSvg,
  };
  return cachedAssets;
}

export async function toggleTree() {
  if (!(await isTreeViewEnabled())) {
    await showUnifiedPanel("tags");
  } else {
    await hideTree();
  }
}

export async function toggleOutline() {
  if (!(await isTreeViewEnabled())) {
    await showUnifiedPanel("outline");
  } else {
    await hideTree();
  }
}

export async function switchView(viewType: ViewType) {
  if (await isTreeViewEnabled()) {
    await showUnifiedPanel(viewType);
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
    // In v2, plugs only ever run client-side (Web Worker sandbox), so there is
    // no server environment to guard against.
    if (await isTreeViewEnabled()) {
      return await showUnifiedPanel(await getLastView());
    }
  } catch (err) {
    console.error(`${PLUG_DISPLAY_NAME}: showTreeIfEnabled failed`, err);
  }
}

// Refreshing on every editor:pageSaved means re-querying the whole tag index
// (and rebuilding the tree) on each save. Coalesce bursts of saves into a
// single refresh once editing settles. The timer lives in the (persistent)
// plug worker scope, so it survives across event invocations.
let saveRefreshTimer: ReturnType<typeof setTimeout> | undefined;
const SAVE_REFRESH_DEBOUNCE_MS = 750;

export function refreshOnSave() {
  if (saveRefreshTimer !== undefined) {
    clearTimeout(saveRefreshTimer);
  }
  saveRefreshTimer = setTimeout(() => {
    saveRefreshTimer = undefined;
    void showTreeIfEnabled();
  }, SAVE_REFRESH_DEBOUNCE_MS);
}


/**
 * Shows a unified panel that can display either tag tree or outline view
 */
export async function showUnifiedPanel(viewType: ViewType = "tags") {
  await setLastView(viewType);
  const config: TagTreeViewConfig = await getPlugConfig();

  if (currentPosition && config.position !== currentPosition) {
    await hideTree();
  }

  try {
      const {
        sortableTreeCss, sortableTreeJs, plugCss, plugJs,
        iconHeaderCollapse, iconHeaderExpand, iconNavigation2, iconRefresh,
        iconXCircle, nodeIconCollapsedSvg, nodeIconOpenSvg,
      } = await loadAssets();

      // Fetch data based on view type
      const [{ nodes }, currentPage, customStyles] = await Promise.all([
        viewType === "tags" ? getTagTree(config) : getOutlineTree(),
        editor.getCurrentPage(),
        getCustomStyles(),
      ]);

      // Prepare config for the frontend JS, including node icon SVG content
      const treeViewJsConfig = {
        nodes,
        currentPage, // Pass current page for highlighting
        treeElementId: viewType === "tags" ? "treeview-tree" : "outline-tree",
        dragAndDrop: { enabled: false }, // Keep D&D disabled
        viewType, // Pass the current view type
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
          <link rel="stylesheet" href=".client/components.css" />
          <style>
            ${sortableTreeCss}
            ${plugCss} /* CSS matching the desired appearance */
            ${customStyles ?? ""}
          </style>
          <div class="treeview-root">
            <div class="treeview-header">
              <div class="treeview-view-switcher">
                <button type="button" data-treeview-action="switch-tags" class="${viewType === "tags" ? "active" : ""}" title="Tags View">Tags</button>
                <button type="button" data-treeview-action="switch-outline" class="${viewType === "outline" ? "active" : ""}" title="Outline View">Outline</button>
              </div>
              <div class="treeview-actions">
                <div class="treeview-actions-left">
                  <button type="button" data-treeview-action="expand-all" title="Expand all">${iconHeaderExpand}</button>
                  <button type="button" data-treeview-action="collapse-all" title="Collapse all">${iconHeaderCollapse}</button>
                  ${viewType === "tags" ? `<button type="button" data-treeview-action="reveal-current-page" title="Reveal current page">${iconNavigation2}</button>` : ""}
                  <button type="button" data-treeview-action="refresh" title="Refresh view">${iconRefresh}</button>
                </div>
                <div class="treeview-actions-right">
                  <button type="button" data-treeview-action="close-panel" title="Close panel">${iconXCircle}</button>
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

  } catch (error: any) {
      console.error("Error loading assets or showing tree view:", error);
      editor.flashNotification(`Error loading tree view: ${error.message}`, "error");
      await hideTree();
  }
}

// Compatibility function referenced by the manifest (`show`).
export async function showTree() {
  return await showUnifiedPanel("tags");
}

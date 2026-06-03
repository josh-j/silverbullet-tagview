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

// Signature of what is currently rendered in the panel. v2 has no plug->panel
// push channel and showPanel always wipes the iframe body, so the only way to
// avoid a full rebuild is to not call showPanel when the result would be
// identical. Event-driven refreshes (navigation, debounced save, deletes) skip
// the rebuild when this matches; user-initiated actions force a render.
let lastRenderSignature: string | undefined;

// The tag tree depends only on the tag index (which changes on save/delete),
// not on which page is open. So cache it and reuse it across navigation,
// re-querying the whole index only when a data-changing event marks it dirty.
// (The outline view is page-specific and cheap to re-parse, so it is not cached.)
let cachedTagTree: Awaited<ReturnType<typeof getTagTree>> | undefined;
let tagTreeDirty = true;

async function getTagData(
  config: TagTreeViewConfig,
): Promise<Awaited<ReturnType<typeof getTagTree>>> {
  if (tagTreeDirty || !cachedTagTree) {
    cachedTagTree = await getTagTree(config);
    tagTreeDirty = false;
  }
  return cachedTagTree;
}

// Serializing the whole node tree for the render signature is wasteful when the
// tree is unchanged. Cache the serialization keyed by node-array identity, so a
// reused (reference-equal) tag tree is not re-stringified on every navigation.
let cachedNodesSig: { nodes: unknown; sig: string } | undefined;
function nodesSignature(nodes: unknown): string {
  if (cachedNodesSig && cachedNodesSig.nodes === nodes) {
    return cachedNodesSig.sig;
  }
  const sig = JSON.stringify(nodes);
  cachedNodesSig = { nodes, sig };
  return sig;
}

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
    await showUnifiedPanel("tags", true);
  } else {
    await hideTree();
  }
}

export async function toggleOutline() {
  if (!(await isTreeViewEnabled())) {
    await showUnifiedPanel("outline", true);
  } else {
    await hideTree();
  }
}

export async function switchView(viewType: ViewType) {
  if (await isTreeViewEnabled()) {
    // User-initiated (view switcher / refresh button) -> always render.
    await showUnifiedPanel(viewType, true);
  }
}

export async function hideTree() {
  if (currentPosition) {
    await editor.hidePanel(currentPosition);
    currentPosition = undefined;
    lastRenderSignature = undefined;
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
  // A save may have added/removed tags, so the cached tag tree is now stale.
  tagTreeDirty = true;
  if (saveRefreshTimer !== undefined) {
    clearTimeout(saveRefreshTimer);
  }
  saveRefreshTimer = setTimeout(() => {
    saveRefreshTimer = undefined;
    void showTreeIfEnabled();
  }, SAVE_REFRESH_DEBOUNCE_MS);
}

export async function refreshOnDelete() {
  // Deleting a page can remove tags it carried, so invalidate the tag cache.
  tagTreeDirty = true;
  await showTreeIfEnabled();
}


/**
 * Shows a unified panel that can display either tag tree or outline view
 */
export async function showUnifiedPanel(viewType: ViewType = "tags", force = false) {
  await setLastView(viewType);
  // A user-initiated render (refresh/toggle/switch) should reflect fresh data.
  if (force) tagTreeDirty = true;
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

      // Fetch data based on view type. Tags reuse the cached tree across
      // navigation (see getTagData); outline is page-specific and re-parsed.
      const [{ nodes }, currentPage, customStyles] = await Promise.all([
        viewType === "tags" ? getTagData(config) : getOutlineTree(),
        editor.getCurrentPage(),
        getCustomStyles(),
      ]);

      // Skip the (DOM-wiping) showPanel call when an event-driven refresh would
      // produce an identical panel — e.g. saving a page whose tags/headers did
      // not change. The cheap scalars are JSON-encoded; the node tree is
      // serialized via nodesSignature, which reuses the cached string when the
      // tree is reference-equal (the common navigation case for tags).
      const signature =
        JSON.stringify([viewType, config.position, currentPage, customStyles ?? ""]) +
        nodesSignature(nodes);
      if (!force && currentPosition === config.position &&
          signature === lastRenderSignature) {
        return;
      }

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
      lastRenderSignature = signature;

  } catch (error: any) {
      console.error("Error loading assets or showing tree view:", error);
      editor.flashNotification(`Error loading tree view: ${error.message}`, "error");
      await hideTree();
  }
}

// Compatibility function referenced by the manifest (`show`). Explicit show.
export async function showTree() {
  return await showUnifiedPanel("tags", true);
}

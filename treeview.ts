import {
  asset,
  editor,
  index,
  mq,
  space,
} from "@silverbulletmd/silverbullet/syscalls";
import { getTagTree, TagIndexEntry } from "./api.ts";
import { matchTag, renameTagInText } from "./rename.ts";
import {
  getCustomStyles,
  isTreeViewEnabled,
  PLUG_DISPLAY_NAME,
  PLUG_NAME,
  PLUG_VERSION,
  Position,
  setTreeViewEnabled,
  TagTreeViewConfig,
} from "./config.ts";
import { getPlugConfig } from "./config.ts";

let currentPosition: Position | undefined;
let focusFilterOnRender = false;

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
  iconEdit: string;
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
    iconEdit,
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
    asset.readAsset(PLUG_NAME, "assets/icons/edit-2.svg"),
    asset.readAsset(PLUG_NAME, "assets/icons/chevron-right.svg"),
    asset.readAsset(PLUG_NAME, "assets/icons/chevron-down.svg"),
  ]);
  cachedAssets = {
    sortableTreeCss, sortableTreeJs, plugCss, plugJs,
    iconHeaderCollapse, iconHeaderExpand, iconNavigation2, iconRefresh,
    iconXCircle, iconEdit, nodeIconCollapsedSvg, nodeIconOpenSvg,
  };
  return cachedAssets;
}

export async function toggleTree() {
  if (!(await isTreeViewEnabled())) {
    await showTreePanel(true);
  } else {
    await hideTree();
  }
}

export async function refreshTree() {
  if (await isTreeViewEnabled()) {
    await showTreePanel(true);
  }
}

export async function focusFilter() {
  focusFilterOnRender = true;
  await showTreePanel(true);
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
      return await showTreePanel();
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
 * Shows the tag tree panel.
 */
export async function showTreePanel(force = false) {
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
        iconXCircle, iconEdit, nodeIconCollapsedSvg, nodeIconOpenSvg,
      } = await loadAssets();

      const [{ nodes }, currentPage, customStyles] = await Promise.all([
        getTagData(config),
        editor.getCurrentPage(),
        getCustomStyles(),
      ]);

      // Skip the (DOM-wiping) showPanel call when an event-driven refresh would
      // produce an identical panel — e.g. saving a page whose tags did
      // not change. The cheap scalars are JSON-encoded; the node tree is
      // serialized via nodesSignature, which reuses the cached string when the
      // tree is reference-equal (the common navigation case for tags).
      const signature =
        JSON.stringify([config.position, currentPage, customStyles ?? ""]) +
        nodesSignature(nodes);
      if (!force && currentPosition === config.position &&
          signature === lastRenderSignature) {
        return;
      }

      // Prepare config for the frontend JS, including node icon SVG content
      const focusFilter = focusFilterOnRender;
      focusFilterOnRender = false;
      const treeViewJsConfig = {
        nodes,
        currentPage, // Pass current page for highlighting
        treeElementId: "treeview-tree",
        focusFilter,
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
          <link rel="stylesheet" href=".client/components.css" />
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
                  <button type="button" data-treeview-action="rename-tag" title="Rename the selected tag (or pick one)">${iconEdit}</button>
                  <button type="button" data-treeview-action="refresh" title="Refresh view">${iconRefresh}</button>
                </div>
                <div class="treeview-actions-right">
                  <button type="button" data-treeview-action="close-panel" title="Close panel">${iconXCircle}</button>
                </div>
              </div>
              <div class="treeview-filter-row">
                <input id="treeview-filter" type="search" placeholder="Filter" title="Filter tags and pages" autocomplete="off" spellcheck="false" />
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
  return await showTreePanel(true);
}

// Command: "Tag Tree: Version" — report the installed plug version.
export async function showVersion() {
  await editor.flashNotification(`${PLUG_DISPLAY_NAME} v${PLUG_VERSION}`);
}

// Command: "Tag Tree: Rename Tag" (and the panel rename button). Renames a tag
// and all hierarchical children across every page that uses them, in both
// inline #hashtags and frontmatter `tags:` lists. Callable with no argument
// (interactive picker) or with a specific oldTag (e.g. the tag clicked in the
// panel).
export async function renameTag(oldTag?: string) {
  let tagObjs: TagIndexEntry[] = [];
  try {
    tagObjs = await index.queryLuaObjects<TagIndexEntry>("tag", {});
  } catch (e) {
    console.error("renameTag: failed to read tag index", e);
    await editor.flashNotification("Could not read tags from the index.", "error");
    return;
  }

  // 1. Pick the tag to rename (when not supplied by the caller).
  if (!oldTag) {
    const names = [...new Set(tagObjs.map((t) => t?.name).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b),
    );
    if (names.length === 0) {
      await editor.flashNotification("No tags found to rename.", "info");
      return;
    }
    const choice = await editor.filterBox(
      "Rename tag",
      names.map((n) => ({ name: n })),
      "Pick the tag to rename — its child tags are renamed too",
    );
    if (!choice) return;
    oldTag = choice.name;
  }

  // 2. New name. Normalize: drop a leading `#` the user may have typed and trim.
  const entered = await editor.prompt(`Rename #${oldTag} to:`, oldTag);
  const newTag = entered?.trim().replace(/^#+/, "").trim();
  if (!newTag || newTag === oldTag) return;

  // 3. Find affected pages (and count child tags) using the rename rule.
  const affectedPages = new Set<string>();
  const childTags = new Set<string>();
  for (const t of tagObjs) {
    if (!t || typeof t.name !== "string" || typeof t.page !== "string") continue;
    if (matchTag(t.name, oldTag, newTag) !== null) {
      affectedPages.add(t.page);
      if (t.name !== oldTag) childTags.add(t.name);
    }
  }
  if (affectedPages.size === 0) {
    await editor.flashNotification(`No pages use #${oldTag}.`, "info");
    return;
  }

  // 4. Confirm.
  const fileWord = affectedPages.size === 1 ? "file" : "files";
  const childNote = childTags.size > 0
    ? ` (incl. ${childTags.size} child tag${childTags.size === 1 ? "" : "s"})`
    : "";
  const ok = await editor.confirm(
    `Rename #${oldTag} → #${newTag} across ${affectedPages.size} ${fileWord}${childNote}?`,
  );
  if (!ok) return;

  // 5. Rewrite each page. The open page is edited via the editor buffer to
  // avoid clobbering unsaved edits / disk-vs-buffer conflicts.
  const currentPage = await editor.getCurrentPage();
  let updated = 0;
  const failures: string[] = [];
  for (const page of affectedPages) {
    try {
      if (page === currentPage) {
        const text = await editor.getText();
        const newText = await renameTagInText(text, oldTag, newTag);
        if (newText !== text) {
          await editor.setText(newText);
          // Persist immediately so the change is indexed (and picked up by the
          // panel refresh below) rather than waiting for the autosave debounce.
          await editor.save();
          updated++;
        }
      } else {
        const text = await space.readPage(page);
        const newText = await renameTagInText(text, oldTag, newTag);
        if (newText !== text) {
          await space.writePage(page, newText);
          updated++;
        }
      }
    } catch (e) {
      console.error(`renameTag: failed to rewrite ${page}`, e);
      failures.push(page);
    }
  }

  // 6. Wait for reindex, invalidate the tag cache, refresh the panel.
  try {
    await mq.awaitEmptyQueue("indexQueue");
  } catch {
    // best-effort; the panel refresh below will pick up whatever is indexed
  }
  tagTreeDirty = true;
  if (await isTreeViewEnabled()) {
    await showTreePanel(true);
  }

  let msg = `Renamed #${oldTag} → #${newTag} in ${updated} ${
    updated === 1 ? "file" : "files"
  }`;
  if (failures.length > 0) {
    msg += `; ${failures.length} failed (see console)`;
  }
  await editor.flashNotification(msg, failures.length > 0 ? "error" : "info");
}

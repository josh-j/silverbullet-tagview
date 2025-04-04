/**
 * @typedef {import("../api.ts").TagData} TagData // Use TagData type from api.ts
 */

/**
 * Represents a node in the SortableTree specific to tags.
 * @typedef SortableTagTreeNode
 * @type {Object}
 * @property {TagData} data - The tag data associated with the node.
 */

/**
 * Configuration for the Tag TreeView panel.
 * @typedef TagTreeViewJsConfig
 * @type {Object}
 * @property {Array<{data: TagData, nodes: []}>} nodes - A flat list of tag nodes.
 * @property {string} treeElementId - The ID of the HTML element to render the tree in.
 * @property {Object} dragAndDrop - Drag and drop configuration (should be disabled).
 * @property {boolean} dragAndDrop.enabled - Should always be false for tags.
 */


const TREE_STATE_ID = "treeview"; // Keep state ID, though collapse state less relevant for flat list

/**
 * Initializes the Tag TreeView's `SortableTree` instance.
 * @param {TagTreeViewJsConfig} config
 * @returns {SortableTree}
 */
function createTagTreeView(config) {
  // Note: SortableTree might still add D&D classes/attributes even if disabled.
  // The key is that the handlers (`confirm`) are removed and `disableSorting` is true.
  return new SortableTree({
    nodes: config.nodes, // Use the flat list of tag nodes
    disableSorting: true, // Disable sorting/D&D for tags
    element: document.getElementById(config.treeElementId),
    stateId: TREE_STATE_ID, // Keep for potential future use (e.g., remembering scroll)
    initCollapseLevel: 0, // Not very relevant for a flat list
    lockRootLevel: true, // Root cannot be targeted (good practice)

    /**
     * @param {SortableTagTreeNode} movedNode
     * @param {SortableTagTreeNode} targetParentNode
     */
    // REMOVED: confirm handler - D&D is not applicable for tags in this view.
    // confirm: async (movedNode, targetParentNode) => { ... },

    // onChange is likely not needed without D&D or hierarchy, but harmless.
    // It triggers a refresh if node state changes (e.g., collapse, though unlikely here).
    onChange: async () => {
      // Optional: Could remove if performance is critical and no state changes expected.
      // await syscall("system.invokeFunction", "treeview.show");
    },

    /**
     * Handles clicking on a tag node.
     * @param {Event} _event
     * @param {SortableTagTreeNode} node
     */
    onClick: async (_event, node) => {
      // Navigate to a query for the clicked tag
      console.log("Tag clicked:", node.data.name);
      // Use query.set to change the main query bar and filter
      await syscall("editor.runCommand", "query.set", `tag: ${node.data.name}`);
      // Alternative: Trigger a search in the search panel
      // await syscall("editor.runCommand", "search.search", `tag:${node.data.name}`);
    },

    /**
     * Renders the label HTML for a tag node.
     * @param {TagData} data - The data for the tag node.
     * @returns {string}
     */
    renderLabel: (data) => {
      // data.name = Full tag name (e.g., "project/alpha")
      // data.title = Display name (same as name for tags)
      // data.nodeType = "tag"
      // data.pageCount = Number of pages with this tag (optional, from backend)

      // Removed data-current-page (not applicable)
      // Removed data-permission (assuming 'perm' is not on TagData)
      // Added data-node-type="tag"
      // Added page count display if available
      const pageCountHtml = typeof data.pageCount === 'number'
        ? `<span class="treeview-node-pagecount">(${data.pageCount})</span>`
        : '';

      return `
        <span
          data-node-type="${data.nodeType}"
          title="${data.name}" >
          ${data.title}${pageCountHtml}
        </span>`;
    },
  });
}

/**
 * Initializes the tag tree view panel and its action bar.
 * @param {TagTreeViewJsConfig} config
 */
// deno-lint-ignore no-unused-vars
function initializeTreeViewPanel(config) {
  // Ensure dragAndDrop is explicitly disabled in the config passed from main.ts
  config.dragAndDrop = { enabled: false };

  const tree = createTagTreeView(config); // Call the renamed creation function

  const handleAction = (action) => {
    switch (action) {
      // REMOVED: collapse-all (not applicable to flat list)
      // case "collapse-all": { ... }
      // REMOVED: expand-all (not applicable to flat list)
      // case "expand-all": { ... }
      case "close-panel": {
        syscall("system.invokeFunction", "treeview.hide"); // Use configured plug name's functions
        return true;
      }
      case "refresh": {
        // Clear saved state before refreshing to avoid issues if node list changes significantly
        tree.clearState();
        syscall("system.invokeFunction", "treeview.show"); // Use configured plug name's functions
        return true;
      }
      // REMOVED: reveal-current-page (not applicable)
      // case "reveal-current-page": { ... }
    }
    return false;
  }

  // REMOVED: Initial call to handleAction("reveal-current-page");

  // Add listeners only to the buttons that still exist (refresh, close-panel)
  document.querySelectorAll("[data-treeview-action]").forEach((el) => {
    const action = el.dataset["treeviewAction"];
    // Only attach listener if the action is still handled
    if (action === "refresh" || action === "close-panel") {
      el.addEventListener("click", (e) => {
        if (handleAction(action)) {
          e.stopPropagation();
          e.preventDefault();
        }
      });
    } else {
      // Optional: Hide or remove buttons for unsupported actions
      // el.style.display = 'none';
    }
  });
}

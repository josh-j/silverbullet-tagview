/**
 * @typedef {import("../api.ts").NodeData} NodeData // Use base NodeData type
 */

/**
 * Represents a node in the SortableTree (tag or folder).
 * @typedef SortableTreeNode
 * @type {Object}
 * @property {NodeData} data - The tag or folder data.
 */

/**
 * Configuration for the Hierarchical Tag TreeView panel.
 * @typedef TagTreeViewJsConfig
 * @type {Object}
 * @property {Array<{data: NodeData, nodes: Array}>} nodes - A tree of tag/folder nodes.
 * @property {string} treeElementId - The ID of the HTML element.
 * @property {Object} dragAndDrop - Should still be disabled.
 * @property {boolean} dragAndDrop.enabled - False.
 */


const TREE_STATE_ID = "treeview"; // State ID relevant for collapse/expand

/**
 * Initializes the Hierarchical Tag TreeView's `SortableTree` instance.
 * @param {TagTreeViewJsConfig} config
 * @returns {SortableTree}
 */
function createTagTreeView(config) {
  return new SortableTree({
    nodes: config.nodes,
    disableSorting: true, // Keep D&D disabled
    element: document.getElementById(config.treeElementId),
    stateId: TREE_STATE_ID, // State now relevant for collapse/expand
    initCollapseLevel: 1, // Start with only root nodes expanded (adjust as needed)
    lockRootLevel: true,

    // No 'confirm' handler needed

    // onChange can be useful for saving state if nodes are collapsed/expanded
    onChange: async () => {
       // This will trigger a full refresh, potentially saving the collapse state
       // via the SortableTree's state saving mechanism (if enabled and working).
       // Consider if this refresh is too disruptive or if a more targeted state save is needed.
       await syscall("system.invokeFunction", "treeview.show");
    },

    /**
     * Handles clicking on a node (tag or folder).
     * @param {Event} _event
     * @param {SortableTreeNode} node
     */
    onClick: async (_event, node) => {
      // Only run the query if it's an actual 'tag' node.
      // Clicking a 'folder' node should just toggle it (handled by SortableTree's default behavior on the collapse icon).
      if (node.data.nodeType === 'tag') {
        console.log("Tag clicked:", node.data.name);
        await syscall("editor.runCommand", "query.set", `tag:${node.data.name}`);
      } else {
        console.log("Folder clicked:", node.data.name);
        // If you want clicking anywhere on the folder label (not just the icon) to toggle it:
        node.toggle();
      }
    },

    /**
     * Renders the label HTML for a tag or folder node.
     * @param {NodeData} data - The data for the node.
     * @returns {string}
     */
// Inside createTagTreeView function...
    renderLabel: (data) => {
      const pageCountHtml = data.nodeType === 'tag' && typeof data.pageCount === 'number'
        ? `<span class="treeview-node-pagecount">(${data.pageCount})</span>`
        : ''; // Only show count for tags

      // Add a separate span for the full path detail
      const fullPathHtml = `<span class="treeview-fullpath-detail">#${data.name}</span>`;

      // Combine title, count, and path detail within the main span
      // We add a wrapper span with display: block to try and force path onto new line
      return `
        <span
          data-node-type="${data.nodeType}"
          title="${data.name}"
          style="line-height: 1.2;" >  
             ${data.title}${pageCountHtml}
             <span style="display: block; font-size: 0.8em; opacity: 0.7; margin-left: 0;"> ${fullPathHtml} </span>
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
  config.dragAndDrop = { enabled: false }; // Ensure D&D is disabled
  const tree = createTagTreeView(config);

  const handleAction = (action) => {
    switch (action) {
      // Handle expand/collapse all actions
       case "collapse-all": {
         // Target all nodes that are open AND have subnodes (folders)
         document.querySelectorAll("sortable-tree-node[open='true']").forEach((node) => {
             // Check if the subnodes container (second child div) is not empty
             if (node.children[1] && node.children[1].children.length > 0) {
                 node.collapse(true);
             }
         });
         return true;
       }
       case "expand-all": {
         // Target all nodes that are not open AND have subnodes (folders)
         document.querySelectorAll("sortable-tree-node:not([open='true'])").forEach((node) => {
             // Check if the subnodes container (second child div) is not empty
             if (node.children[1] && node.children[1].children.length > 0) {
                node.collapse(false);
             }
         });
         return true;
       }
      case "close-panel": {
        syscall("system.invokeFunction", "treeview.hide");
        return true;
      }
      case "refresh": {
        // Clear state before refresh to ensure tree rebuilds visually if structure changed
        // Note: This might clear user's collapse/expand preferences for this session.
        tree.clearState();
        syscall("system.invokeFunction", "treeview.show");
        return true;
      }
    }
    return false;
  }

  // Add listeners for all potential actions defined in the HTML
  document.querySelectorAll("[data-treeview-action]").forEach((el) => {
    const action = el.dataset["treeviewAction"];
    // Attach listener if the action is handled
    if (["refresh", "close-panel", "collapse-all", "expand-all"].includes(action)) {
      el.addEventListener("click", (e) => {
        if (handleAction(action)) {
          e.stopPropagation();
          e.preventDefault();
        }
      });
    }
  });
}

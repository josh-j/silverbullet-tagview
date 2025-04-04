/**
 * @typedef {import("../api.ts").NodeData} NodeData // Union type: Folder | Tag | Page
 */

/**
 * Represents a node in the SortableTree (folder, tag, or page).
 * @typedef SortableTreeNode
 * @type {Object}
 * @property {NodeData} data - The node data.
 */

/**
 * Configuration for the TreeView panel showing pages under tags.
 * @typedef TagPageTreeViewJsConfig
 * @type {Object}
 * @property {Array<{data: NodeData, nodes: Array}>} nodes - A tree of folder/tag/page nodes.
 * @property {string} treeElementId - The ID of the HTML element.
 * @property {Object} dragAndDrop - Should still be disabled.
 * @property {boolean} dragAndDrop.enabled - False.
 */


const TREE_STATE_ID = "treeview"; // State ID relevant for collapse/expand

/**
 * Initializes the TreeView's `SortableTree` instance.
 * @param {TagPageTreeViewJsConfig} config
 * @returns {SortableTree}
 */
function createTagTreeView(config) {
  return new SortableTree({
    nodes: config.nodes,
    disableSorting: true, // Keep D&D disabled
    element: document.getElementById(config.treeElementId),
    stateId: TREE_STATE_ID, // State now relevant for collapse/expand
    initCollapseLevel: 1, // Start with only root nodes expanded
    lockRootLevel: true,

    // No 'confirm' handler needed

    // onChange might be useful for saving state
    onChange: async () => {
       await syscall("system.invokeFunction", "treeview.show");
    },

    /**
     * Handles clicking on a node (folder, tag, or page).
     * @param {Event} _event
     * @param {SortableTreeNode} node
     */
    onClick: async (_event, node) => {
      const nodeType = node.data.nodeType;
      const nodeName = node.data.name;

      if (nodeType === 'page') {
        // It's a page node - navigate to it
        console.log("Panel: Page node clicked, navigating to:", nodeName);
        try {
          await syscall("editor.navigate", nodeName);
        } catch (e) {
           console.error("Panel: Error navigating to page:", e);
           syscall("editor.flashNotification", `Error navigating: ${e.message}`, "error");
        }
      } else if (nodeType === 'folder' || nodeType === 'tag') {
        // It's a folder or tag node, toggle it when the label is clicked
        // The collapse icon click is handled automatically by SortableTree
        console.log(`Panel: ${nodeType} node clicked:`, nodeName);
        node.toggle();
      } else {
         console.warn("Panel: Clicked node with unknown type:", node.data);
      }
    },

    /**
     * Renders the label HTML for a node.
     * @param {NodeData} data - The data for the node.
     * @returns {string}
     */
    renderLabel: (data) => {
        let content = '';
        const title = data.title || data.name; // Fallback to name if title missing

        if (data.nodeType === 'tag' && typeof data.pageCount === 'number') {
          // Tag node: Show title and page count
          content = `${title} <span class="treeview-node-pagecount">(${data.pageCount})</span>`;
        } else {
          // Folder or Page node: Just show title
          content = title;
        }

        // Return the span with appropriate data attributes
        return `
          <span
            data-node-type="${data.nodeType}"
            title="${data.name}" >
             ${content}
          </span>`;
      },
  });
}

/**
 * Initializes the tag tree view panel and its action bar.
 * @param {TagPageTreeViewJsConfig} config
 */
// deno-lint-ignore no-unused-vars
function initializeTreeViewPanel(config) {
  config.dragAndDrop = { enabled: false }; // Ensure D&D is disabled
  const tree = createTagTreeView(config);

  const handleAction = (action) => {
    switch (action) {
       case "collapse-all": {
         document.querySelectorAll("sortable-tree-node[open='true']").forEach((node) => {
             if (node.children[1] && node.children[1].children.length > 0) {
                 node.collapse(true);
             }
         });
         return true;
       }
       case "expand-all": {
         document.querySelectorAll("sortable-tree-node:not([open='true'])").forEach((node) => {
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
        tree.clearState();
        syscall("system.invokeFunction", "treeview.show");
        return true;
      }
    }
    return false;
  }

  // Add listeners for actions
  document.querySelectorAll("[data-treeview-action]").forEach((el) => {
    const action = el.dataset["treeviewAction"];
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

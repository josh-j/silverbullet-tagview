/**
 * @typedef {import("../api.ts").NodeData} NodeData // Union type: Folder | Tag | Page
 */

/**
 * Represents a node in the SortableTree (folder, tag, or page).
 * @typedef SortableTreeNode
 * @type {Object}
 * @property {NodeData} data - The node data.
 * @property {function} collapse - Function to collapse/expand the node.
 * @property {function} toggle - Function to toggle the collapse state.
 * @property {HTMLElement} children - Child elements (including subnodes container).
 * @property {function} reveal - Expands parent nodes to make this node visible.
 * @property {function} scrollIntoView - Scrolls the node into the visible area.
 */

/**
 * Configuration for the TreeView panel showing pages under tags.
 * @typedef TagPageTreeViewJsConfig
 * @type {Object}
 * @property {Array<{data: NodeData, nodes: Array}>} nodes - A tree of folder/tag/page nodes.
 * @property {string} treeElementId - The ID of the HTML element where the tree will be rendered.
 * @property {Object} dragAndDrop - Drag and drop configuration (should be disabled).
 * @property {boolean} dragAndDrop.enabled - Should be false.
 * @property {string} currentPage - Name of the currently open page.
 */

/**
 * Global syscall function provided by SilverBullet.
 * @function syscall
 * @param {string} name - The name of the system call.
 * @param {...any} args - Arguments for the system call.
 * @returns {Promise<any>}
 */

/**
 * Global SortableTree class constructor.
 * @class SortableTree
 * @param {Object} options - Configuration options for the tree.
 * @property {function} clearState - Method to clear the persisted collapse/expand state.
 * @property {function} findNode - Method to find a node based on data property.
 */


// ID used for persisting the collapse/expand state in sessionStorage
const TREE_STATE_ID = "treeview";

// Store current page globally within the panel's script scope
let panelCurrentPage = "";

/**
 * Initializes the TreeView's `SortableTree` instance using CSS for icons.
 * @param {TagPageTreeViewJsConfig} config - Configuration object for the tree view.
 * @returns {SortableTree} The created SortableTree instance.
 */
function createTagTreeView(config) {
  // Create the SortableTree instance
  return new SortableTree({
    // Core tree data
    nodes: config.nodes,
    element: document.getElementById(config.treeElementId),

    // Configuration options
    disableSorting: true, // Keep Drag & Drop disabled for tags/pages
    lockRootLevel: true, // Prevent dragging top-level items
    stateId: TREE_STATE_ID, // Enable state persistence for collapse/expand
    initCollapseLevel: 1, // Start with only root nodes expanded (level 0 is root)

    // icons option is NOT provided here - using default +/-

    // No confirmation needed for D&D as it's disabled
    // confirm: async (movedNode, targetParentNode) => true,

    onChange: async () => {
       console.log("Tree structure changed (if D&D were enabled)");
    },

    /**
     * Handles clicking on a node label (folder, tag, or page).
     * @param {Event} _event - The click event (often unused).
     * @param {SortableTreeNode} node - The clicked SortableTree node instance.
     */
    onClick: async (_event, node) => {
      const nodeType = node.data.nodeType; // 'folder', 'tag', or 'page'
      const nodeName = node.data.name; // Full tag path or page name

      if (nodeType === 'page') {
        // It's a page node - navigate to it using SilverBullet's editor syscall
        console.log("Panel: Page node clicked, navigating to:", nodeName);
        try {
          // Check if already on the page to prevent unnecessary navigation
          if (nodeName !== panelCurrentPage) {
            await syscall("editor.navigate", nodeName);
          }
        } catch (e) {
           console.error("Panel: Error navigating to page:", e);
           syscall("editor.flashNotification", `Error navigating: ${e.message}`, "error");
        }
      } else if (nodeType === 'folder' || nodeType === 'tag') {
        // It's a folder or tag node. Toggle its collapse state when the label is clicked.
        console.log(`Panel: ${nodeType} node label clicked, toggling:`, nodeName);
        node.toggle(); // Toggles between collapsed/expanded
      } else {
         console.warn("Panel: Clicked node with unknown type:", node.data);
      }
    },

    /**
     * Renders the HTML content for the label part of a node.
     * Checks if the node represents the currently open page.
     * @param {NodeData} data - The data object associated with the node.
     * @returns {string} HTML string for the node's label content.
     */
    renderLabel: (data) => {
        let content = '';
        const title = data.title || data.name;

        if (data.nodeType === 'tag' && typeof data.pageCount === 'number' && data.pageCount > 0) {
          content = `${title} <span class="treeview-node-pagecount">(${data.pageCount})</span>`;
        } else {
          content = title;
        }

        // Check if this node is the current page
        // Only pages can be the current page
        const isCurrentPage = (data.nodeType === 'page' && data.name === panelCurrentPage);

        return `
          <span
            data-node-type="${data.nodeType}"
            data-current-page="${isCurrentPage}" /* Set true/false */
            title="${data.name}"
          >
             ${content}
          </span>`;
      },
  });
}

/**
 * Initializes the tree view panel, creates the SortableTree, and sets up action button listeners.
 * Stores the current page name for use in renderLabel.
 * @param {TagPageTreeViewJsConfig} config - The configuration passed from the plug's backend.
 */
// deno-lint-ignore no-unused-vars
function initializeTreeViewPanel(config) {
  // Store currentPage from config
  panelCurrentPage = config.currentPage || ""; // Store globally in panel scope

  config.dragAndDrop = { enabled: false };
  const tree = createTagTreeView(config); // Create the tree instance

  // Handler for action buttons in the panel header
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
        syscall("system.invokeFunction", "treeview.show"); // Will re-run this whole init
        return true;
      }
      // *** ADD reveal-current-page handler ***
      case "reveal-current-page": {
        // Find the node corresponding to the current page
        // We need to search based on the 'name' property in the node data
        const pageNodeElement = Array.from(document.querySelectorAll('sortable-tree-node .tree__label > span[data-node-type="page"]'))
                                   .find(span => span.getAttribute('title') === panelCurrentPage);

        if (pageNodeElement) {
            // Get the parent sortable-tree-node custom element
            const sortableNode = pageNodeElement.closest('sortable-tree-node');
            if (sortableNode && typeof sortableNode.reveal === 'function') {
                sortableNode.reveal(); // Expand ancestors
                // Scroll the specific label span into view
                pageNodeElement.scrollIntoView({
                    behavior: "smooth", // "auto" or "smooth"
                    block: "nearest",
                    inline: "nearest",
                });
                return true;
            } else {
                console.warn("Could not find sortable-tree-node for current page element or reveal function missing.");
            }
        } else {
            console.warn("Could not find node for current page:", panelCurrentPage);
            syscall("editor.flashNotification", "Current page not found in tree.", "info");
        }
        return false; // Indicate page wasn't found or revealed
      }
    }
    return false; // Action not recognized or handled
  }

  // Add click listeners to all action buttons in the header
  // Ensure the new action is included in the list of handled actions
  const handledActions = ["refresh", "close-panel", "collapse-all", "expand-all", "reveal-current-page"];
  document.querySelectorAll("[data-treeview-action]").forEach((el) => {
    const action = el.dataset["treeviewAction"];
    if (handledActions.includes(action)) { // Check if action is handled
      el.addEventListener("click", (e) => {
        if (handleAction(action)) {
          e.stopPropagation();
          e.preventDefault();
        }
      });
    }
  });

  console.log("TreeView panel initialized. Current page:", panelCurrentPage);
}

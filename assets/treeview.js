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
 */

/**
 * Configuration for the TreeView panel showing pages under tags.
 * @typedef TagPageTreeViewJsConfig
 * @type {Object}
 * @property {Array<{data: NodeData, nodes: Array}>} nodes - A tree of folder/tag/page nodes.
 * @property {string} treeElementId - The ID of the HTML element where the tree will be rendered.
 * @property {Object} dragAndDrop - Drag and drop configuration (should be disabled).
 * @property {boolean} dragAndDrop.enabled - Should be false.
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
 */


// ID used for persisting the collapse/expand state in sessionStorage
const TREE_STATE_ID = "treeview";

/**
 * Initializes the TreeView's `SortableTree` instance using the library's icon configuration.
 * @param {TagPageTreeViewJsConfig} config - Configuration object for the tree view.
 * @returns {SortableTree} The created SortableTree instance.
 */
function createTagTreeView(config) {
  // Define SVG icons for collapsed (chevron right) and open (chevron down) states
  // These SVGs will be inserted by the SortableTree library into the `.tree__collapse` span.
  const collapsedIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
  const openIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

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

    // Provide the icons directly to the library
    icons: {
        collapsed: collapsedIcon,
        open: openIcon,
    },

    // No confirmation needed for D&D as it's disabled
    // confirm: async (movedNode, targetParentNode) => true,

    // onChange might be useful for saving state or other actions if D&D were enabled
    onChange: async () => {
       // Example: Refreshing on change might save the collapse state if needed,
       // but state persistence via stateId should handle this automatically.
       // Consider if a full refresh is desired on structural changes (if D&D enabled).
       // await syscall("system.invokeFunction", "treeview.show");
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
          await syscall("editor.navigate", nodeName);
        } catch (e) {
           console.error("Panel: Error navigating to page:", e);
           // Show an error notification to the user
           syscall("editor.flashNotification", `Error navigating: ${e.message}`, "error");
        }
      } else if (nodeType === 'folder' || nodeType === 'tag') {
        // It's a folder or tag node. Toggle its collapse state when the label is clicked.
        // The click on the actual chevron icon is handled automatically by SortableTree.
        console.log(`Panel: ${nodeType} node label clicked, toggling:`, nodeName);
        node.toggle(); // Toggles between collapsed/expanded
      } else {
         // Log a warning if a node with an unexpected type is clicked
         console.warn("Panel: Clicked node with unknown type:", node.data);
      }
    },

    /**
     * Renders the HTML content for the label part of a node.
     * @param {NodeData} data - The data object associated with the node.
     * @returns {string} HTML string for the node's label content.
     */
    renderLabel: (data) => {
        let content = '';
        // Use title for display (usually the last part of the path), fallback to name if title is missing
        const title = data.title || data.name;

        // For 'tag' nodes, append the page count if it's greater than 0
        if (data.nodeType === 'tag' && typeof data.pageCount === 'number' && data.pageCount > 0) {
          content = `${title} <span class="treeview-node-pagecount">(${data.pageCount})</span>`;
        } else {
          // For 'folder' or 'page' nodes, just display the title
          content = title;
        }

        // Return the main span element for the label.
        // - data-node-type attribute is used for CSS styling (e.g., page icon).
        // - title attribute provides a tooltip showing the full name (path).
        return `
          <span
            data-node-type="${data.nodeType}"
            title="${data.name}"
          >
             ${content}
          </span>`;
      },
  });
}

/**
 * Initializes the tree view panel, creates the SortableTree, and sets up action button listeners.
 * This function is intended to be called from the panel's inline script.
 * @param {TagPageTreeViewJsConfig} config - The configuration passed from the plug's backend.
 */
// Add deno-lint-ignore if necessary in your environment, but it's standard practice
// for functions called from inline scripts not to be flagged as unused.
// deno-lint-ignore no-unused-vars
function initializeTreeViewPanel(config) {
  // Ensure Drag & Drop is explicitly disabled in the config passed to createTagTreeView
  config.dragAndDrop = { enabled: false };
  const tree = createTagTreeView(config); // Create the tree instance

  // Handler for action buttons in the panel header
  const handleAction = (action) => {
    switch (action) {
       case "collapse-all": {
         // Find all currently open nodes
         document.querySelectorAll("sortable-tree-node[open='true']").forEach((node) => {
             // Check if the node actually has visible children before collapsing
             // node.children[1] is the subnodes container (div)
             if (node.children[1] && node.children[1].children.length > 0) {
                 node.collapse(true); // Collapse the node
             }
         });
         return true; // Indicate action was handled
       }
       case "expand-all": {
         // Find all currently closed nodes
         document.querySelectorAll("sortable-tree-node:not([open='true'])").forEach((node) => {
            // Check if the node has children before expanding
             if (node.children[1] && node.children[1].children.length > 0) {
                node.collapse(false); // Expand the node
             }
         });
         return true; // Indicate action was handled
       }
      case "close-panel": {
        // Call the plug's backend function to hide the panel
        syscall("system.invokeFunction", "treeview.hide");
        return true; // Indicate action was handled
      }
      case "refresh": {
        // Clear the persisted state (collapse/expand) before refreshing
        // This helps ensure the initCollapseLevel is respected on refresh.
        tree.clearState();
        // Call the plug's backend function to reload and show the tree
        syscall("system.invokeFunction", "treeview.show");
        return true; // Indicate action was handled
      }
    }
    return false; // Action not recognized or handled
  }

  // Add click listeners to all action buttons in the header
  document.querySelectorAll("[data-treeview-action]").forEach((el) => {
    const action = el.dataset["treeviewAction"];
    // Check if the action is one we handle
    if (["refresh", "close-panel", "collapse-all", "expand-all"].includes(action)) {
      el.addEventListener("click", (e) => {
        // If the action was handled, prevent default browser behavior and event bubbling
        if (handleAction(action)) {
          e.stopPropagation();
          e.preventDefault();
        }
      });
    }
  });

  // Initial setup is complete. The tree is rendered and interactive.
  console.log("TreeView panel initialized.");
}

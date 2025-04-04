/**
 * JSDoc type definition for the tree node data structure expected from api.ts.
 * Adjust properties (name, title, nodeType, perm, isCurrentPage etc.)
 * based on what your getTagTree function actually returns.
 * @typedef {object} TreeNodeData
 * @property {string} name - Unique identifier for the node (e.g., tag name, path). Used for navigation.
 * @property {string} title - Display text for the node.
 * @property {string} [nodeType] - Optional type identifier (e.g., 'tag', 'folder').
 * @property {string} [perm] - Optional permission indicator ('ro', 'rw').
 * @property {boolean} [isCurrentPage] - Optional flag if the node represents the current context.
 */

/**
 * JSDoc type definition for the structure used by the SortableTree library.
 * @typedef {object} SortableTreeNode
 * @property {TreeNodeData} data - The actual data associated with the node.
 * @property {SortableTreeNode[]} [children] - Child nodes for hierarchical structure.
 */

/**
 * JSDoc type definition for the configuration object passed from treeview.ts.
 * @typedef {object} TreeViewConfig
 * @property {string} currentPage - The current page/context name from SilverBullet.
 * @property {SortableTreeNode[]} nodes - A tree structure of tags/nodes to display.
 * @property {string} treeElementId - The ID of the HTML element to render the tree into.
 * @property {object} dragAndDrop - Drag and drop related config.
 * @property {boolean} dragAndDrop.enabled - True if drag and drop sorting is enabled (should be false for tags).
 * @property {object} icons - SVG content for node icons.
 * @property {string} icons.nodeIconOpenSvg - SVG string for the open node icon.
 * @property {string} icons.nodeIconCollapsedSvg - SVG string for the collapsed node icon.
 */


// ID used for storing the tree's collapsed/expanded state in clientStore
const TREE_STATE_ID = "treeview";

/**
 * Creates and initializes the SortableTree instance.
 * @param {TreeViewConfig} config - The configuration object passed from treeview.ts.
 * @returns {SortableTree} The initialized SortableTree instance.
 */
function createTreeView(config) {
  // Use the SortableTree library constructor
  return new SortableTree({
    // Core tree data
    nodes: config.nodes, // The hierarchical node structure

    // Target HTML element
    element: document.getElementById(config.treeElementId),

    // Configuration options
    disableSorting: !config.dragAndDrop.enabled, // Disable sorting if D&D is not enabled (should be true for tags)
    stateId: TREE_STATE_ID, // Key for saving expand/collapse state
    initCollapseLevel: 0, // Start with top-level nodes expanded
    lockRootLevel: false, // Allow interaction with top-level nodes

    // --- FIX: Use the SVG icons passed in the config ---
    // This assumes SortableTree library accepts SVG strings directly.
    // Check the library's documentation if this doesn't work.
    icons: {
       collapsed: config.icons.nodeIconCollapsedSvg, // Use chevron-right SVG content
       open: config.icons.nodeIconOpenSvg           // Use chevron-down SVG content
    },

    // --- FIX: Removed 'confirm' callback as Drag and Drop is disabled ---
    // The confirm callback is only relevant when nodes are moved via D&D.

    // Callback triggered when the tree structure changes (e.g., expand/collapse)
    // Useful for persisting state if needed beyond the library's built-in stateId handling.
    onChange: async () => {
      // Example: Could invoke a function to save custom state if needed.
      // await syscall("system.invokeFunction", "treeview.saveState", tree.getState());
      // For now, just log or do nothing if stateId handles persistence sufficiently.
      console.log("Tree state changed (expand/collapse)");
    },

    // Callback triggered when a node is clicked
    onClick: async (_event, node) => {
      // Navigate to the item represented by the node (e.g., the tag page)
      // Assumes node.data.name is the correct identifier for navigation.
      if (node.data && node.data.name) {
        await syscall("editor.navigate", node.data.name, false, false);
      } else {
        console.warn("TreeView node clicked, but node.data.name is missing:", node);
      }
    },

    // Function to customize how each node's label is rendered
    renderLabel: (data) => {
      // Use data properties provided by getTagTree in api.ts
      // Ensure data properties (isCurrentPage, nodeType, perm, name, title) exist.
      const isCurrent = data.isCurrentPage || false;
      const nodeType = data.nodeType || 'unknown';
      const permission = data.perm || ''; // Read/Write permission if available
      const name = data.name || ''; // Use name for title attribute (tooltip)
      const title = data.title || name || 'Untitled'; // Display title, fallback to name

      // Render the label HTML, using data attributes for potential styling or interaction
      return `
        <span
          data-current-page="${isCurrent}"
          data-node-type="${nodeType}"
          data-permission="${permission}"
          title="${name}" >
          ${title}
        </span>`;
    },
  });
}

/**
 * Initializes the tree view panel, including the tree itself and the action bar buttons.
 * This function is called from treeview.ts after the panel is shown.
 * @param {TreeViewConfig} config - The configuration object received from treeview.ts.
 */
// deno-lint-ignore no-unused-vars - This function is called dynamically from treeview.ts
function initializeTreeViewPanel(config) {
  // Create the SortableTree instance using the received config
  const tree = createTreeView(config);

  // Function to handle clicks on the header action buttons
  const handleAction = (action) => {
    switch (action) {
      case "collapse-all": {
        // Collapse all currently open nodes recursively
        document.querySelectorAll("sortable-tree-node[open='true']").forEach((node) => node.collapse(true));
        return true; // Indicate action was handled
      }
      case "expand-all": {
        // Expand all currently closed nodes recursively
        document.querySelectorAll("sortable-tree-node:not([open='true'])").forEach((node) => node.collapse(false));
        return true; // Indicate action was handled
      }
      case "close-panel": {
        // Invoke the hide function in treeview.ts via syscall
        syscall("system.invokeFunction", "treeview.hide");
        return true; // Indicate action was handled
      }
      case "refresh": {
        // Invoke the show function in treeview.ts via syscall to reload data/config
        syscall("system.invokeFunction", "treeview.show");
        return true; // Indicate action was handled
      }
      case "reveal-current-page": {
        // Find the node marked as representing the current page/context
        // Assumes getTagTree correctly sets 'isCurrentPage: true' on the relevant node data.
        const currentNode = tree.findNode("isCurrentPage", true);
        if (currentNode) {
          // Expand ancestors and scroll the node into view
          currentNode.reveal();
          currentNode.scrollIntoView({
            behavior: "auto", // Use 'smooth' for smooth scrolling if preferred
            block: "nearest", // Align to nearest edge of the scroll container
            inline: "nearest",
          });
          return true; // Indicate action was handled
        }
        console.warn("Reveal current page: Node with isCurrentPage=true not found.");
        return false; // Indicate action was not handled (node not found)
      }
    }
    // Return false if the action string didn't match any known actions
    return false;
  };

  // Attempt to reveal the current page/tag node when the panel first loads
  handleAction("reveal-current-page");

  // Add click event listeners to all elements with a 'data-treeview-action' attribute
  document.querySelectorAll("[data-treeview-action]").forEach((el) => {
    el.addEventListener("click", (e) => {
      // Get the action name from the data attribute
      const actionName = el.dataset["treeviewAction"];
      // If the action was handled successfully, prevent default browser behavior and stop propagation
      if (actionName && handleAction(actionName)) {
        e.stopPropagation();
        e.preventDefault();
      }
    });
  });

  console.log("TreeView panel initialized.");
}

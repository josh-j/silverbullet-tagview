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
 * @property {Object} nodeIcons - Contains SVG content for node icons.
 * @property {string} nodeIcons.collapsed - SVG string for collapsed state.
 * @property {string} nodeIcons.open - SVG string for open state.
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
 * Initializes the TreeView's `SortableTree` instance using chevron SVG icons passed via config.
 * @param {TagPageTreeViewJsConfig} config - Configuration object for the tree view.
 * @returns {SortableTree} The created SortableTree instance.
 */
function createTagTreeView(config) {

  // Get SVG icon content from the config object
  // Provide default fallbacks just in case they aren't passed correctly
  const collapsedIcon = config.nodeIcons?.collapsed || `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
  const openIcon = config.nodeIcons?.open || `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

  // Create the SortableTree instance
  return new SortableTree({
    nodes: config.nodes,
    element: document.getElementById(config.treeElementId),
    disableSorting: true,
    lockRootLevel: true,
    stateId: TREE_STATE_ID,
    initCollapseLevel: 1,
    // Use the icons received from the config
    icons: {
        collapsed: collapsedIcon,
        open: openIcon,
    },

    onChange: async () => {
       console.log("Tree structure changed (if D&D were enabled)");
    },

    onClick: async (_event, node) => {
      const nodeType = node.data.nodeType;
      const nodeName = node.data.name;

      if (nodeType === 'page') {
        console.log("Panel: Page node clicked, navigating to:", nodeName);
        try {
          if (nodeName !== panelCurrentPage) {
            await syscall("editor.navigate", nodeName);
          }
        } catch (e) {
           console.error("Panel: Error navigating to page:", e);
           syscall("editor.flashNotification", `Error navigating: ${e.message}`, "error");
        }
      } else if (nodeType === 'header') {
        console.log("Panel: Header text clicked, navigating to position:", node.data.pos);
        try {
          // Always navigate when clicking on header text
          // If the header has children and is collapsed, expand it first
          if (node.children && node.children[1] && node.children[1].children.length > 0) {
            // Check if this node is collapsed (doesn't have open="true" attribute)
            if (!node.hasAttribute('open') || node.getAttribute('open') !== 'true') {
              node.collapse(false); // Expand this node
            }
          }
          // Use the same navigation approach as the Lua toc widget
          await syscall("editor.navigate", `${panelCurrentPage}@${node.data.pos}`);
        } catch (e) {
           console.error("Panel: Error navigating to header:", e);
           syscall("editor.flashNotification", `Error navigating to header: ${e.message}`, "error");
        }
      } else if (nodeType === 'folder' || nodeType === 'tag') {
        console.log(`Panel: ${nodeType} node label clicked, toggling:`, nodeName);
        node.toggle();
      } else {
         console.warn("Panel: Clicked node with unknown type:", node.data);
      }
    },

    /**
     * Renders the HTML content for the label part of a node.
     * Treats tags and folders the same (no page count).
     * Checks if the node represents the currently open page.
     * @param {NodeData} data - The data object associated with the node.
     * @returns {string} HTML string for the node's label content.
     */
    renderLabel: (data) => {
        // Always use title for folders and tags
        const title = data.title || data.name;
        let content = title; // Use title directly

        const isCurrentPage = (data.nodeType === 'page' && data.name === panelCurrentPage);
        
        // Add header level as data attribute for CSS targeting
        let additionalAttributes = '';
        if (data.nodeType === 'header' && data.level) {
          additionalAttributes = `data-header-level="${data.level}"`;
        }

        return `
          <span
            data-node-type="${data.nodeType}"
            data-current-page="${isCurrentPage}"
            ${additionalAttributes}
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
  panelCurrentPage = config.currentPage || "";

  config.dragAndDrop = { enabled: false };
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
        const currentView = config.viewType || "tags";
        syscall("system.invokeFunction", "treeview.switchView", currentView);
        return true;
      }
      case "switch-tags": {
        syscall("system.invokeFunction", "treeview.switchView", "tags");
        return true;
      }
      case "switch-outline": {
        syscall("system.invokeFunction", "treeview.switchView", "outline");
        return true;
      }
      case "reveal-current-page": {
        // Find the node element based on the title attribute matching the current page
        const pageNodeElement = Array.from(document.querySelectorAll('sortable-tree-node .tree__label > span[data-node-type="page"]'))
                                   .find(span => span.getAttribute('title') === panelCurrentPage);

        if (pageNodeElement) {
            // Get the parent sortable-tree-node custom element
            const sortableNode = pageNodeElement.closest('sortable-tree-node');
            // Check if the node and reveal function exist
            if (sortableNode && typeof sortableNode.reveal === 'function') {
                sortableNode.reveal(); // Expand ancestors
                // Scroll the specific label span into view
                pageNodeElement.scrollIntoView({
                    behavior: "smooth", // "auto" or "smooth"
                    block: "nearest",
                    inline: "nearest",
                });
                return true; // Action handled
            } else {
                console.warn("Could not find sortable-tree-node for current page element or reveal function missing.");
            }
        } else {
            // Notify if the current page isn't found in the tree (e.g., excluded or not tagged)
            console.warn("Could not find node for current page:", panelCurrentPage);
            syscall("editor.flashNotification", "Current page not found in tree.", "info");
        }
        return false; // Indicate page wasn't found or revealed
      }
    }
    return false; // Action not recognized or handled
  }

  // Define the actions handled by buttons
  const handledActions = ["refresh", "close-panel", "collapse-all", "expand-all", "reveal-current-page", "switch-tags", "switch-outline"];
  // Add click listeners to all action buttons
  document.querySelectorAll("[data-treeview-action]").forEach((el) => {
    const action = el.dataset["treeviewAction"];
    if (handledActions.includes(action)) { // Check if action is handled
      el.addEventListener("click", (e) => {
        // If the action was handled, prevent default browser behavior and event bubbling
        if (handleAction(action)) {
          e.stopPropagation();
          e.preventDefault();
        }
      });
    }
  });

  console.log("TreeView panel initialized. Current page:", panelCurrentPage);
}

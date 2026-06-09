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
const TREE_STATE_ID = "treeview-tags-collapsed";

// Set to true to surface verbose panel logging in the browser console.
const DEBUG = false;
const debug = (...args) => { if (DEBUG) console.log(...args); };

// Escape a string for safe interpolation into HTML text/attributes. Page and
// tag names can legitimately contain &, <, >, " which would otherwise break
// the rendered markup.
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Store current page globally within the panel's script scope
let panelCurrentPage = "";

// The most recently clicked tag/folder node — its path drives the rename
// button, and the element gets a "treeview-selected" class for visual feedback.
// Both reset on each panel rebuild (the button then falls back to the picker).
let lastTagPath = "";
let selectedNodeEl = null;

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
    initCollapseLevel: 0,
    // Use the icons received from the config
    icons: {
        collapsed: collapsedIcon,
        open: openIcon,
    },

    onChange: async () => {
       debug("Tree structure changed (if D&D were enabled)");
    },

    onClick: async (_event, node) => {
      const nodeType = node.data.nodeType;
      const nodeName = node.data.name;

      if (nodeType === 'page') {
        debug("Panel: Page node clicked, navigating to:", nodeName);
        try {
          if (nodeName !== panelCurrentPage) {
            await syscall("editor.navigate", nodeName);
          }
        } catch (e) {
           console.error("Panel: Error navigating to page:", e);
           syscall("editor.flashNotification", `Error navigating: ${e.message}`, "error");
        }
      } else if (nodeType === 'folder' || nodeType === 'tag') {
        debug(`Panel: ${nodeType} node label clicked, toggling:`, nodeName);
        // Mark this tag as the rename target and highlight it.
        lastTagPath = nodeName;
        if (selectedNodeEl && selectedNodeEl !== node) {
          selectedNodeEl.classList.remove("treeview-selected");
        }
        node.classList.add("treeview-selected");
        selectedNodeEl = node;
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
        const content = escapeHtml(data.title || data.name);

        const isCurrentPage = (data.nodeType === 'page' && data.name === panelCurrentPage);

        return `
          <span
            data-node-type="${escapeHtml(data.nodeType)}"
            data-current-page="${isCurrentPage}"
            title="${escapeHtml(data.name)}"
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
  const rootEl = document.querySelector(".treeview-root");
  const treeEl = document.getElementById(config.treeElementId);
  const filterInput = document.getElementById("treeview-filter");

  const applyFilter = (rawQuery) => {
    const query = String(rawQuery || "").trim().toLowerCase();
    rootEl?.classList.toggle("treeview-filtering", query.length > 0);

    const visit = (node, ancestorMatched = false) => {
      const data = node.data || {};
      const haystack = `${data.title || ""} ${data.name || ""}`.toLowerCase();
      const selfMatches = query.length > 0 && haystack.includes(query);
      const subtreeIncluded = ancestorMatched || selfMatches;
      let childVisible = false;

      Array.from(node.subnodes?.children || []).forEach((child) => {
        childVisible = visit(child, subtreeIncluded) || childVisible;
      });

      const visible = query.length === 0 || subtreeIncluded || childVisible;
      node.classList.toggle("treeview-filter-hidden", !visible);
      node.classList.toggle("treeview-filter-visible", visible);
      node.classList.toggle("treeview-filter-match", selfMatches);
      return visible;
    };

    Array.from(treeEl?.children || []).forEach((node) => visit(node));
  };

  filterInput?.addEventListener("input", () => applyFilter(filterInput.value));
  filterInput?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (filterInput.value) {
        filterInput.value = "";
        applyFilter("");
      } else {
        filterInput.blur();
      }
      event.preventDefault();
      event.stopPropagation();
    }
  });

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const isTyping = target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target?.isContentEditable;
    if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && !isTyping) {
      filterInput?.focus();
      filterInput?.select();
      event.preventDefault();
    }
  });

  if (config.focusFilter) {
    setTimeout(() => {
      filterInput?.focus();
      filterInput?.select();
    }, 0);
  }

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
        syscall("system.invokeFunction", "treeview.refresh");
        return true;
      }
      case "rename-tag": {
        // Rename the last-clicked tag if there is one; otherwise the plug runs
        // the interactive tag picker.
        if (lastTagPath) {
          syscall("system.invokeFunction", "treeview.renameTag", lastTagPath);
        } else {
          syscall("system.invokeFunction", "treeview.renameTag");
        }
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
  const handledActions = ["refresh", "close-panel", "collapse-all", "expand-all", "reveal-current-page", "rename-tag"];
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

  debug("TreeView panel initialized. Current page:", panelCurrentPage);
}

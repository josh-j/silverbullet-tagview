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
    initCollapseLevel: 1, // Start with only root nodes expanded
    lockRootLevel: true,

    // No 'confirm' handler needed

    // onChange can be useful for saving state if nodes are collapsed/expanded
    onChange: async () => {
       await syscall("system.invokeFunction", "treeview.show");
    },

    /**
     * Handles clicking on a node (tag or folder).
     * If tag, fetches pages and shows filterBox. If folder, toggles.
     * @param {Event} _event
     * @param {SortableTreeNode} node
     */
    onClick: async (_event, node) => {
      if (node.data.nodeType === 'tag') {
        // It's a tag node - fetch associated pages
        console.log("Panel: Tag clicked, fetching pages for:", node.data.name);
        try {
          // Call backend function to get pages for this specific tag
          const pageList = await syscall("system.invokeFunction", "treeview.getPagesForTag", node.data.name);
          console.log("Panel: Received pages:", pageList);

          if (pageList && pageList.length > 0) {
            // Format pages for filterBox
            const pageOptions = pageList.map(pageName => ({
              name: `📄 ${pageName}`, // Add page icon (optional)
              description: `Navigate to page tagged #${node.data.name}`,
              value: pageName // Store page name to navigate to
            }));

            // Show filter box with page options
            const selectedPage = await syscall(
              "editor.filterBox",
              `Pages tagged #${node.data.name}`, // Title for the filter box
              pageOptions,                      // The list of pages
              "Select a page to navigate or Esc to cancel" // Help text
            );

            // If the user selected a page
            if (selectedPage && selectedPage.value) {
              console.log("Panel: Navigating to selected page:", selectedPage.value);
              // Navigate to the selected page's name (stored in value)
              await syscall("editor.navigate", selectedPage.value);
            } else {
              console.log("Panel: Page selection cancelled.");
            }
          } else {
            // No pages found for this tag
            console.log("Panel: No pages found for tag:", node.data.name);
            syscall("editor.flashNotification", `No pages found for tag #${node.data.name}`, "info");
          }
        } catch (e) {
          // Handle errors during the process
          console.error("Panel: Error fetching or showing pages for tag:", e);
          syscall("editor.flashNotification", `Error showing pages for tag: ${e.message}`, "error");
        }
      } else {
        // It's a folder node, toggle it when the label is clicked
        console.log("Panel: Folder clicked:", node.data.name);
        node.toggle();
      }
    },

    /**
     * Renders the label HTML for a tag or folder node.
     * Includes title and page count (for tags).
     * @param {NodeData} data - The data for the node.
     * @returns {string}
     */
    renderLabel: (data) => {
        const pageCountHtml = data.nodeType === 'tag' && typeof data.pageCount === 'number'
          ? `<span class="treeview-node-pagecount">(${data.pageCount})</span>`
          : ''; // Only show count for tags

        // Return only title and page count inside the main span
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
  config.dragAndDrop = { enabled: false }; // Ensure D&D is disabled
  const tree = createTagTreeView(config);

  const handleAction = (action) => {
    switch (action) {
      // Handle expand/collapse all actions
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

  // Add listeners for all potential actions defined in the HTML
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

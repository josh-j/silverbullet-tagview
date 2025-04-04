import { editor, system } from "@silverbulletmd/silverbullet/syscalls";
// PageMeta might not be directly needed anymore
// import { PageMeta } from "@silverbulletmd/silverbullet/types";
import { PLUG_DISPLAY_NAME, TagTreeViewConfig } from "./config.ts";

// --- Data Structures ---

// Define the expected structure of objects returned by index.queryObjects("tag",...)
interface TagIndexEntry {
  name: string; // The tag name (e.g., "cs/lang/meta")
  page: string; // The page the tag appears on
  [key: string]: any; // Allow other potential fields
}

// Define possible node data types
type PageNodeData = { name: string; title: string; nodeType: "page"; };
type FolderNodeData = { name: string; title: string; nodeType: "folder"; };
type TagNodeData = { name: string; title: string; nodeType: "tag"; pageCount: number; }; // Keep count on tag node itself

// Union type for node data
type NodeData = FolderNodeData | TagNodeData | PageNodeData;

// TreeNode structure remains the same, but data can be any of the above types
export type TreeNode = {
  data: NodeData;
  nodes: TreeNode[];
};


/**
 * Generates a hierarchical TreeNode array including tags, folders, AND associated pages.
 * Fetches data using index.queryObjects("tag", ...).
 */
export async function getTagTree(config: TagTreeViewConfig): Promise<{ nodes: TreeNode[] }> {
  // --- Step 1: Fetch tag index entries ---
  let tagIndexEntries: TagIndexEntry[] = [];
  try {
     tagIndexEntries = await system.invokeFunction(
      "index.queryObjects", "tag", {}
    );
  } catch (e) {
      console.error("Failed to fetch tags via index.queryObjects('tag',...):", e);
      editor.flashNotification(`Error fetching tags: ${e.message}`, "error");
      return { nodes: [] };
  }

  // --- Step 2: Process entries to map tags to unique page names ---
  // Map: tagName -> Set<pageName>
  const tagPageMap = new Map<string, Set<string>>();
  for (const entry of tagIndexEntries) {
    if (entry && typeof entry.name === 'string' && entry.name && typeof entry.page === 'string' && entry.page) {
      if (!tagPageMap.has(entry.name)) {
        tagPageMap.set(entry.name, new Set<string>());
      }
      tagPageMap.get(entry.name)!.add(entry.page);
    } else {
        console.warn("Skipping invalid tag index entry:", entry);
    }
  }

  // Calculate counts and get unique tags
  const tagCounts: Record<string, number> = {};
  const uniqueTags: string[] = [];
  for (const [tagName, pageSet] of tagPageMap.entries()) {
    tagCounts[tagName] = pageSet.size;
    uniqueTags.push(tagName);
  }
  uniqueTags.sort((a, b) => a.localeCompare(b));


  // --- Step 3: Build the hierarchical tree including page nodes ---
  const root: { nodes: TreeNode[] } = { nodes: [] };

  uniqueTags.forEach((tag) => {
    const parts = tag.split("/");
    parts.reduce((parent, title, currentIndex) => {
      const currentPath = parts.slice(0, currentIndex + 1).join("/");
      const isLeafTagNode = currentIndex === parts.length - 1; // This part represents the actual tag

      let node = parent.nodes.find((child) => child.data.title === title && child.data.name === currentPath); // Match path too

      if (node) {
        // Node exists. If it's the leaf tag level and was previously a folder, update it.
        if (isLeafTagNode && node.data.nodeType === "folder") {
          // Update existing folder node to be a tag node with count
          node.data = {
            ...node.data, // Keep name/title
            nodeType: "tag",
            pageCount: tagCounts[tag] || 0,
          };
          // ** ADD PAGES for this existing node **
          const pages = tagPageMap.get(tag) || new Set();
          node.nodes = Array.from(pages).sort().map(pageName => ({
              data: {
                  name: pageName, // Full page name for navigation
                  // Extract last part of page name for display title? Optional.
                  title: pageName.includes('/') ? pageName.substring(pageName.lastIndexOf('/') + 1) : pageName,
                  nodeType: "page",
              },
              nodes: [], // Pages are always leaves
          }));
        } else if (isLeafTagNode && node.data.nodeType === "tag") {
           // If it already exists as a tag, ensure pages are added (might happen if tag 'a' and 'a/b' exist)
           if (node.nodes.length === 0) { // Only add pages if not already added
                const pages = tagPageMap.get(tag) || new Set();
                node.nodes = Array.from(pages).sort().map(pageName => ({
                    data: {
                        name: pageName,
                        title: pageName.includes('/') ? pageName.substring(pageName.lastIndexOf('/') + 1) : pageName,
                        nodeType: "page",
                    },
                    nodes: [],
                }));
           }
           // Update page count just in case
           (node.data as TagNodeData).pageCount = tagCounts[tag] || 0;
        }
        // If it's an existing folder node (not leaf), just proceed
        return node; // Use existing node as parent for next level
      }

      // Node doesn't exist, create it
      let newNode: TreeNode;
      if (isLeafTagNode) {
        // Create a 'tag' node and add its pages as children
        const pages = tagPageMap.get(tag) || new Set();
        const pageNodes = Array.from(pages).sort().map(pageName => ({
            data: {
                name: pageName,
                title: pageName.includes('/') ? pageName.substring(pageName.lastIndexOf('/') + 1) : pageName,
                nodeType: "page",
            },
            nodes: [],
        }));

        newNode = {
          data: {
            name: currentPath,
            title: title,
            nodeType: "tag",
            pageCount: tagCounts[tag] || 0,
          },
          nodes: pageNodes, // Add page nodes here
        };
      } else {
        // Create a 'folder' node
        newNode = {
          data: {
            name: currentPath,
            title: title,
            nodeType: "folder",
          },
          nodes: [], // Child tags/folders will be added in subsequent iterations
        };
      }

      parent.nodes.push(newNode);
      parent.nodes.sort((a,b) => a.data.title.localeCompare(b.data.title));
      return newNode; // Use new node as parent for next level
    }, root);
  });

  return {
    nodes: root.nodes,
  };
}

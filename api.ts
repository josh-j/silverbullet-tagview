import { editor, system } from "@silverbulletmd/silverbullet/syscalls";
// PageMeta might not be directly needed anymore
// import { PageMeta } from "@silverbulletmd/silverbullet/types";
import { PLUG_DISPLAY_NAME, TagTreeViewConfig } from "./config.ts";

// --- Data Structures ---

// Define the expected structure of objects returned by index.queryObjects("tag",...)
// Note: The exact fields might vary slightly based on SilverBullet version/indexing.
interface TagIndexEntry {
  name: string; // The tag name (e.g., "cs/lang/meta")
  page: string; // The page the tag appears on
  [key: string]: any; // Allow other potential fields
}

// Define possible node data types
type PageNodeData = {
    name: string; // Full page name (for navigation)
    title: string; // Display title (e.g., page name without path)
    nodeType: "page";
};
type FolderNodeData = {
    name: string; // Partial tag path (e.g., "cs", "cs/lang")
    title: string; // Current segment (e.g., "cs", "lang")
    nodeType: "folder";
};
type TagNodeData = {
    name: string; // Full tag name (e.g., "cs/lang/meta")
    title: string; // Last segment (e.g., "meta")
    nodeType: "tag";
    pageCount: number; // Number of pages directly associated with this tag
};

// Union type for node data
type NodeData = FolderNodeData | TagNodeData | PageNodeData;

// TreeNode structure remains the same, but data can be any of the above types
// And 'nodes' can contain child folders, tags, or pages.
export type TreeNode = {
  data: NodeData;
  nodes: TreeNode[];
};


/**
 * Generates a hierarchical TreeNode array including tags, folders, AND associated pages.
 * Fetches data using index.queryObjects("tag", ...).
 * Sorts folders/tags before pages alphabetically.
 */
export async function getTagTree(config: TagTreeViewConfig): Promise<{ nodes: TreeNode[] }> {
  // --- Step 1: Fetch tag index entries ---
  let tagIndexEntries: TagIndexEntry[] = [];
  try {
     tagIndexEntries = await system.invokeFunction(
      "index.queryObjects",
      "tag", // Query for tag index objects
      {}     // No specific filters needed
    );
  } catch (e) {
      console.error("Failed to fetch tags via index.queryObjects('tag',...):", e);
      // Optionally show a notification to the user
      editor.flashNotification(`Error fetching tags: ${e.message}`, "error");
      return { nodes: [] }; // Return empty tree on error
  }


  // --- Step 2: Process entries to map tags to unique page names ---
  // Map: tagName -> Set<pageName>
  const tagPageMap = new Map<string, Set<string>>();

  for (const entry of tagIndexEntries) {
    // Ensure entry has valid name and page
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

  // Sort unique tags alphabetically (helps with processing order but sort inside reduce is key)
  uniqueTags.sort((a, b) => a.localeCompare(b));


  // --- Step 3: Build the hierarchical tree including page nodes ---
  const root: { nodes: TreeNode[] } = { nodes: [] };

  uniqueTags.forEach((tag) => {
    const parts = tag.split("/");
    parts.reduce((parent, title, currentIndex) => {
      const currentPath = parts.slice(0, currentIndex + 1).join("/");
      const isLeafTagNode = currentIndex === parts.length - 1; // This part represents the actual tag

      // Find existing node by matching title AND the full path generated so far
      // This prevents mixing up 'a/b' with a potential future 'c/b'
      let node = parent.nodes.find((child) => child.data.title === title && child.data.name === currentPath);

      if (node) {
        // Node exists.
        // If it's the leaf tag level and was previously marked as a folder, update it.
        if (isLeafTagNode && node.data.nodeType === "folder") {
          // Update existing folder node to be a tag node with count
          node.data = {
            name: currentPath, // Keep the full path name
            title: title,      // Keep the title segment
            nodeType: "tag",
            pageCount: tagCounts[tag] || 0,
          };
          // ** ADD PAGES for this existing node that just became a tag **
          const pages = tagPageMap.get(tag) || new Set();
          // Add page nodes, ensuring they weren't somehow added before
          const existingPageNames = new Set(node.nodes.map(n => n.data.name));
          const newPageNodes = Array.from(pages)
            .filter(pageName => !existingPageNames.has(pageName)) // Avoid duplicates if logic allows
            .sort()
            .map(pageName => ({
              data: {
                  name: pageName, // Full page name for navigation
                  title: pageName.includes('/') ? pageName.substring(pageName.lastIndexOf('/') + 1) : pageName,
                  nodeType: "page",
              },
              nodes: [], // Pages are always leaves
          }));
          node.nodes.push(...newPageNodes);
          // Re-sort children including new pages
          node.nodes.sort((a, b) => {
              const typeOrder = { folder: 0, tag: 1, page: 2 };
              const aType = a.data.nodeType; const bType = b.data.nodeType;
              const aOrder = typeOrder[aType as keyof typeof typeOrder] ?? 99;
              const bOrder = typeOrder[bType as keyof typeof typeOrder] ?? 99;
              if (aOrder !== bOrder) return aOrder - bOrder;
              return a.data.title.localeCompare(b.data.title);
          });

        } else if (isLeafTagNode && node.data.nodeType === "tag") {
           // If it already exists as a tag, ensure pages are added (might happen if tag 'a' and 'a/b' exist)
           // This scenario is less likely with the path matching in find, but good to be safe
           if (node.nodes.filter(n => n.data.nodeType === 'page').length === 0) { // Only add pages if none exist
                const pages = tagPageMap.get(tag) || new Set();
                node.nodes = Array.from(pages).sort().map(pageName => ({
                    data: {
                        name: pageName,
                        title: pageName.includes('/') ? pageName.substring(pageName.lastIndexOf('/') + 1) : pageName,
                        nodeType: "page",
                    },
                    nodes: [],
                }));
                // Re-sort children including new pages
                node.nodes.sort((a, b) => {
                    const typeOrder = { folder: 0, tag: 1, page: 2 };
                    const aType = a.data.nodeType; const bType = b.data.nodeType;
                    const aOrder = typeOrder[aType as keyof typeof typeOrder] ?? 99;
                    const bOrder = typeOrder[bType as keyof typeof typeOrder] ?? 99;
                    if (aOrder !== bOrder) return aOrder - bOrder;
                    return a.data.title.localeCompare(b.data.title);
                });
           }
           // Update page count just in case
           (node.data as TagNodeData).pageCount = tagCounts[tag] || 0;
        }
        // If it's an existing folder node (not leaf), just proceed
        return node; // Use existing node as parent for next level
      }

      // --- Node doesn't exist, create it ---
      let newNode: TreeNode;
      if (isLeafTagNode) {
        // Create a 'tag' node and add its pages as children
        const pages = tagPageMap.get(tag) || new Set();
        const pageNodes = Array.from(pages).sort().map(pageName => ({
            data: {
                name: pageName, // Full page name
                title: pageName.includes('/') ? pageName.substring(pageName.lastIndexOf('/') + 1) : pageName, // Display title
                nodeType: "page",
            } as PageNodeData, // Explicit cast
            nodes: [],
        }));

        newNode = {
          data: {
            name: currentPath,
            title: title,
            nodeType: "tag",
            pageCount: tagCounts[tag] || 0,
          } as TagNodeData, // Explicit cast
          nodes: pageNodes, // Add page nodes here
        };
      } else {
        // Create a 'folder' node
        newNode = {
          data: {
            name: currentPath,
            title: title,
            nodeType: "folder",
          } as FolderNodeData, // Explicit cast
          nodes: [], // Child tags/folders will be added in subsequent iterations
        };
      }

      parent.nodes.push(newNode);
      // Sort siblings using the new logic
      parent.nodes.sort((a, b) => {
            const typeOrder = { folder: 0, tag: 1, page: 2 };
            const aType = a.data.nodeType;
            const bType = b.data.nodeType;
            const aOrder = typeOrder[aType as keyof typeof typeOrder] ?? 99;
            const bOrder = typeOrder[bType as keyof typeof typeOrder] ?? 99;

            if (aOrder !== bOrder) {
              // Sort by type: folders/tags first, then pages
              return aOrder - bOrder;
            } else {
              // Within the same type, sort alphabetically by title
              return a.data.title.localeCompare(b.data.title);
            }
      });
      return newNode; // Use new node as parent for next level
    }, root); // Start reduction from the root object
  });

  return {
    nodes: root.nodes,
  };
}

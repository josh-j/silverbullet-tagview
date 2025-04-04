import { editor, system } from "@silverbulletmd/silverbullet/syscalls";
// PageMeta might not be directly needed anymore, but keep types for NodeData etc.
import { PageMeta } from "@silverbulletmd/silverbullet/types";
import { PLUG_DISPLAY_NAME, TagTreeViewConfig } from "./config.ts";

// Define the expected structure of objects returned by index.queryObjects("tag",...)
// Note: The exact fields might vary slightly based on SilverBullet version/indexing.
interface TagIndexEntry {
  name: string; // The tag name (e.g., "cs/lang/meta")
  page: string; // The page the tag appears on
  pos?: number; // Position (optional)
  // Potentially other fields...
}

// NodeData, TagData, FolderData, TreeNode definitions remain the same
export type NodeData = {
  name: string;
  title: string;
  nodeType: "folder" | "tag";
  pageCount?: number;
};
export type TagData = NodeData & { nodeType: "tag"; pageCount: number };
export type FolderData = NodeData & { nodeType: "folder" };
export type TreeNode = { data: TagData | FolderData; nodes: TreeNode[]; };

/**
 * Generates a hierarchical TreeNode array based on tags with '/' separators,
 * fetching data using index.queryObjects("tag", ...).
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


  // --- Step 2: Process entries to get unique tags and unique page counts per tag ---
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

  // Calculate counts based on the size of the page sets
  const tagCounts: Record<string, number> = {};
  const uniqueTags: string[] = [];
  for (const [tagName, pageSet] of tagPageMap.entries()) {
    tagCounts[tagName] = pageSet.size;
    uniqueTags.push(tagName);
  }

  // Sort unique tags alphabetically
  uniqueTags.sort((a, b) => a.localeCompare(b));


  // --- Step 3: Build the hierarchical tree (same logic as before) ---
  const root: { nodes: TreeNode[] } = { nodes: [] };

  uniqueTags.forEach((tag) => {
    const parts = tag.split("/");
    parts.reduce((parent, title, currentIndex) => {
      const currentPath = parts.slice(0, currentIndex + 1).join("/");
      const isLeafNode = currentIndex === parts.length - 1;

      let node = parent.nodes.find((child) => child.data.title === title);

      if (node) {
        if (isLeafNode && node.data.nodeType === "folder") {
          node.data = {
            ...node.data,
            nodeType: "tag",
            pageCount: tagCounts[tag], // Use calculated count
          };
        }
        return node;
      }

      // Node doesn't exist, create it
      const newNodeData: NodeData = isLeafNode
        ? { // Tag node
            name: currentPath,
            title: title,
            nodeType: "tag",
            pageCount: tagCounts[tag], // Use calculated count
          }
        : { // Folder node
            name: currentPath,
            title: title,
            nodeType: "folder",
          };

      node = {
          data: newNodeData,
          nodes: [],
      };

      parent.nodes.push(node);
      parent.nodes.sort((a,b) => a.data.title.localeCompare(b.data.title));
      return node;
    }, root);
  });

  return {
    nodes: root.nodes,
  };
}

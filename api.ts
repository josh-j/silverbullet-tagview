import { editor, system } from "@silverbulletmd/silverbullet/syscalls";
import { PageMeta } // Keep PageMeta if needed for tag counts later, otherwise remove
from "@silverbulletmd/silverbullet/types";
import { PLUG_DISPLAY_NAME, TagTreeViewConfig } from "./config.ts"; // Import new config type

// Remove page-specific filter imports
// import { filterPagesByFunction } from "./filters/filterByFunction.ts";
// import { filterPagesByRegex } from "./filters/filterByRegex.ts";
// import { filterPagesByTags } from "./filters/filterByTags.ts";

// Define NodeData structure for Tags
export type NodeData = {
  name: string; // Full tag name (e.g., "project/alpha")
  title: string; // Display title (e.g., "project/alpha")
  // isCurrentPage is not applicable for tags
  nodeType: string; // e.g., "tag"
  // Optional: count of pages with this tag
  pageCount?: number;
};

// Define Tag specific data structure
export type TagData = NodeData & {
  nodeType: "tag";
};

// TreeNode remains structurally similar, but holds TagData
export type TreeNode = {
  data: TagData; // Changed from PageData | FolderData
  nodes: TreeNode[]; // Will likely be empty for a flat tag list
};

/**
 * Generates a TreeNode array based on unique tags found in the space.
 */
export async function getTagTree(config: TagTreeViewConfig) { // Use new config type
  // Get all index entries starting with "tag:"
  // The result is an array of objects, typically { key: string, page: string, value: any }
  // For tags, key is like "tag:myTag", page is the page where it's found. value might be null or 1.
  const tagIndexEntries: { key: string; page: string }[] = await system
    .invokeFunction(
      "index.queryPrefix",
      "tag:",
    );

  const tagCounts: Record<string, number> = {};
  for (const entry of tagIndexEntries) {
    // Extract tag name by removing "tag:" prefix
    const tagName = entry.key.substring(4);
    if (tagName) { // Ensure tag name is not empty
      tagCounts[tagName] = (tagCounts[tagName] || 0) + 1;
    }
  }

  // Get unique tag names and sort them
  const uniqueTags = Object.keys(tagCounts).sort((a, b) =>
    a.localeCompare(b)
  );

  // Create the TreeNode structure (flat list)
  const rootNodes: TreeNode[] = uniqueTags.map((tag) => ({
    data: {
      name: tag,
      title: tag, // For tags, name and title are the same
      nodeType: "tag",
      pageCount: tagCounts[tag], // Include the count
    },
    nodes: [], // No children in a flat list
  }));

  // No concept of "currentPage" in the tag tree context
  return {
    nodes: rootNodes,
    // currentPage: undefined, // Remove currentPage
  };
}

// Remove filter functions (filterPagesByRegex, filterPagesByTags, filterPagesByFunction)
// as they operate on pages, not tags. If tag filtering is needed, new functions
// based on the tag name would be required.

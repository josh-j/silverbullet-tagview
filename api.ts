import { editor, system } from "@silverbulletmd/silverbullet/syscalls";
import { PageMeta } from "@silverbulletmd/silverbullet/types";
import { PLUG_DISPLAY_NAME, TagTreeViewConfig } from "./config.ts"; // Import new config type

// Define NodeData structure for Tags (assuming this is defined above as before)
export type NodeData = {
  name: string;
  title: string;
  nodeType: string;
  pageCount?: number;
};
export type TagData = NodeData & { nodeType: "tag"; };
export type TreeNode = { data: TagData; nodes: TreeNode[]; };


/**
 * Generates a TreeNode array based on unique tags found in the space
 * by querying all pages and extracting their tags.
 */
export async function getTagTree(config: TagTreeViewConfig): Promise<{ nodes: TreeNode[] }> {
  // Fetch ALL page objects using index.queryObjects
  const pages: PageMeta[] = await system.invokeFunction(
    "index.queryObjects",
    "page", // Type of object to query
    {}      // No specific query filters needed, get all pages
  );

  const tagCounts: Record<string, number> = {};

  // Iterate through all pages fetched
  for (const page of pages) {
    // Extract tags from common tag attributes (tags, itags)
    // You might need to adjust this based on where tags are stored in your PageMeta
    const pageTags: string[] = [
      ...(Array.isArray(page.tags) ? page.tags : typeof page.tags === 'string' ? [page.tags] : []),
      ...(Array.isArray(page.itags) ? page.itags : typeof page.itags === 'string' ? [page.itags] : []),
      // Add other potential tag attributes if necessary (e.g., page.data?.tags)
    ].filter(tag => typeof tag === 'string' && tag); // Ensure they are strings and not empty

    const uniquePageTags = new Set(pageTags); // Count each tag only once per page

    for (const tagName of uniquePageTags) {
      if (tagName) { // Ensure tag name is not empty
        tagCounts[tagName] = (tagCounts[tagName] || 0) + 1;
      }
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

  return {
    nodes: rootNodes,
  };
}

// api.ts

import { editor, system } from "@silverbulletmd/silverbullet/syscalls";

// --- Type Definitions ---

// This represents the data we get back from our query for each page.
interface PageQueryResult {
  name: string;
  tags?: string[]; // The 'tags' property is an array of strings.
  [key: string]: any;
}

// These types define the structure of the nodes in our final tree.
type PageNodeData = { name: string; title: string; nodeType: "page" };
type FolderNodeData = { name: string; title: string; nodeType: "folder" };
type TagNodeData = { name: string; title: string; nodeType: "tag"; pageCount: number };
type NodeData = FolderNodeData | TagNodeData | PageNodeData;

export type TreeNode = { data: NodeData; nodes: TreeNode[] };

/**
 * Fetches all pages, processes their tags, and builds a hierarchical tree structure.
 * This function is the core data source for the tag view panel.
 */
export async function getTagTree(): Promise<{ nodes: TreeNode[] }> {
  let allPages: PageQueryResult[] = [];
  try {
    // CORRECTED: Fetch all objects of type "page".
    // This is the working API call for Silverbullet v2.
    allPages = await system.invokeFunction("index.queryObjects", "page", {});
  } catch (e) {
    console.error("Failed to fetch pages via index.queryObjects('page', {}):", e);
    editor.flashNotification(`Error fetching pages for Tag View: ${e.message}`, "error");
    return { nodes: [] };
  }

  // --- Data Processing: Build the tag-to-page mapping ---
  const tagPageMap = new Map<string, Set<string>>();
  for (const page of allPages) {
    // Check if the page has a name and an array of tags.
    if (page && Array.isArray(page.tags) && typeof page.name === "string" && page.name) {
      for (const tagName of page.tags) {
        // If this is the first time we see this tag, create a new Set for it.
        if (!tagPageMap.has(tagName)) {
          tagPageMap.set(tagName, new Set<string>());
        }
        // Add the current page to the set of pages for this tag.
        tagPageMap.get(tagName)!.add(page.name);
      }
    }
  }

  // --- Tree Building: This logic remains the same as it relies on tagPageMap ---
  const tagCounts: Record<string, number> = {};
  const uniqueTags: string[] = [];
  for (const [tagName, pageSet] of tagPageMap.entries()) {
    tagCounts[tagName] = pageSet.size;
    uniqueTags.push(tagName);
  }
  uniqueTags.sort((a, b) => a.localeCompare(b));

  const root: { nodes: TreeNode[] } = { nodes: [] };
  uniqueTags.forEach((tag) => {
    const parts = tag.split("/");
    parts.reduce((parent, title, currentIndex) => {
      const currentPath = parts.slice(0, currentIndex + 1).join("/");
      const isLeafTagNode = currentIndex === parts.length - 1;
      let node = parent.nodes.find((child) => child.data.title === title && child.data.name === currentPath);

      if (node) { // Node already exists
        if (isLeafTagNode && node.data.nodeType === "folder") {
          // It was a folder, but now it's also a tag, so "upgrade" it.
          node.data = { name: currentPath, title: title, nodeType: "tag", pageCount: tagCounts[tag] || 0 };
          const pages = tagPageMap.get(tag) || new Set();
          const pageNodes = Array.from(pages).sort().map(pageName => ({ data: { name: pageName, title: pageName.includes('/') ? pageName.substring(pageName.lastIndexOf('/') + 1) : pageName, nodeType: "page" } as PageNodeData, nodes: [] }));
          node.nodes.push(...pageNodes);
        } else if (isLeafTagNode && node.data.nodeType === "tag") {
           // It's a tag, just update its count.
           (node.data as TagNodeData).pageCount = tagCounts[tag] || 0;
        }
        // Re-sort children
        node.nodes.sort((a, b) => {
            const typeOrder = { folder: 0, tag: 0, page: 1 };
            const aOrder = typeOrder[a.data.nodeType as keyof typeof typeOrder] ?? 99;
            const bOrder = typeOrder[b.data.nodeType as keyof typeof typeOrder] ?? 99;
            if (aOrder !== bOrder) return aOrder - bOrder;
            return a.data.title.localeCompare(b.data.title);
        });
        return node;
      }

      // Node doesn't exist, create it
      let newNode: TreeNode;
      if (isLeafTagNode) {
        const pages = tagPageMap.get(tag) || new Set();
        const pageNodes = Array.from(pages).sort().map(pageName => ({ data: { name: pageName, title: pageName.includes('/') ? pageName.substring(pageName.lastIndexOf('/') + 1) : pageName, nodeType: "page" } as PageNodeData, nodes: [] }));
        newNode = { data: { name: currentPath, title: title, nodeType: "tag", pageCount: tagCounts[tag] || 0 } as TagNodeData, nodes: pageNodes };
      } else {
        newNode = { data: { name: currentPath, title: title, nodeType: "folder" } as FolderNodeData, nodes: [] };
      }

      parent.nodes.push(newNode);
      // Sort siblings after adding a new node
      parent.nodes.sort((a, b) => {
            const typeOrder = { folder: 0, tag: 0, page: 1 };
            const aOrder = typeOrder[a.data.nodeType as keyof typeof typeOrder] ?? 99;
            const bOrder = typeOrder[b.data.nodeType as keyof typeof typeOrder] ?? 99;
            if (aOrder !== bOrder) {
              return aOrder - bOrder;
            }
            return a.data.title.localeCompare(b.data.title);
      });
      return newNode;
    }, root);
  });

  return { nodes: root.nodes };
}

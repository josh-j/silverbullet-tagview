    // --- Keep imports and type definitions the same ---
    import { editor, system } from "@silverbulletmd/silverbullet/syscalls";
    import { PLUG_DISPLAY_NAME, TagTreeViewConfig } from "./config.ts";
    interface TagIndexEntry { name: string; page: string; [key: string]: any; }
    type PageNodeData = { name: string; title: string; nodeType: "page"; };
    type FolderNodeData = { name: string; title: string; nodeType: "folder"; };
    type TagNodeData = { name: string; title: string; nodeType: "tag"; pageCount: number; };
    type NodeData = FolderNodeData | TagNodeData | PageNodeData;
    export type TreeNode = { data: NodeData; nodes: TreeNode[]; };


    export async function getTagTree(config: TagTreeViewConfig): Promise<{ nodes: TreeNode[] }> {
      // --- Data fetching and processing (tagPageMap, tagCounts, uniqueTags) remain the same ---
      let tagIndexEntries: TagIndexEntry[] = [];
      try {
        tagIndexEntries = await system.invokeFunction("index.queryObjects", "tag", {});
      } catch (e) {
        console.error("Failed to fetch tags via index.queryObjects('tag',...):", e);
        editor.flashNotification(`Error fetching tags: ${e.message}`, "error");
        return { nodes: [] };
      }
      const tagPageMap = new Map<string, Set<string>>();
      for (const entry of tagIndexEntries) {
        if (entry && typeof entry.name === 'string' && entry.name && typeof entry.page === 'string' && entry.page) {
          if (!tagPageMap.has(entry.name)) {
            tagPageMap.set(entry.name, new Set<string>());
          }
          tagPageMap.get(entry.name)!.add(entry.page);
        } else { console.warn("Skipping invalid tag index entry:", entry); }
      }
      const tagCounts: Record<string, number> = {};
      const uniqueTags: string[] = [];
      for (const [tagName, pageSet] of tagPageMap.entries()) {
        tagCounts[tagName] = pageSet.size;
        uniqueTags.push(tagName);
      }
      uniqueTags.sort((a, b) => a.localeCompare(b));

      // --- Tree building ---
      const root: { nodes: TreeNode[] } = { nodes: [] };
      uniqueTags.forEach((tag) => {
        const parts = tag.split("/");
        parts.reduce((parent, title, currentIndex) => {
          const currentPath = parts.slice(0, currentIndex + 1).join("/");
          const isLeafTagNode = currentIndex === parts.length - 1;
          let node = parent.nodes.find((child) => child.data.title === title && child.data.name === currentPath);

          if (node) { // Node exists
            if (isLeafTagNode && node.data.nodeType === "folder") {
              node.data = { name: currentPath, title: title, nodeType: "tag", pageCount: tagCounts[tag] || 0, };
              const pages = tagPageMap.get(tag) || new Set();
              const existingPageNames = new Set(node.nodes.map(n => n.data.name));
              const newPageNodes = Array.from(pages).filter(pageName => !existingPageNames.has(pageName)).sort().map(pageName => ({ data: { name: pageName, title: pageName.includes('/') ? pageName.substring(pageName.lastIndexOf('/') + 1) : pageName, nodeType: "page", } as PageNodeData, nodes: [], }));
              node.nodes.push(...newPageNodes);
            } else if (isLeafTagNode && node.data.nodeType === "tag") {
               if (node.nodes.filter(n => n.data.nodeType === 'page').length === 0) {
                    const pages = tagPageMap.get(tag) || new Set();
                    const pageNodes = Array.from(pages).sort().map(pageName => ({ data: { name: pageName, title: pageName.includes('/') ? pageName.substring(pageName.lastIndexOf('/') + 1) : pageName, nodeType: "page", } as PageNodeData, nodes: [], }));
                    node.nodes.push(...pageNodes);
               }
               (node.data as TagNodeData).pageCount = tagCounts[tag] || 0;
            }
            // Re-sort children after potential modification
            node.nodes.sort((a, b) => {
                // *** USE CORRECTED SORT LOGIC HERE TOO ***
                const typeOrder = { folder: 0, tag: 0, page: 1 }; // Group folder & tag
                const aType = a.data.nodeType; const bType = b.data.nodeType;
                const aOrder = typeOrder[aType as keyof typeof typeOrder] ?? 99;
                const bOrder = typeOrder[bType as keyof typeof typeOrder] ?? 99;
                if (aOrder !== bOrder) return aOrder - bOrder; // Sort by type first
                return a.data.title.localeCompare(b.data.title); // Then alphabetically
            });
            return node; // Use existing node as parent
          }

          // Node doesn't exist, create it
          let newNode: TreeNode;
          if (isLeafTagNode) {
            const pages = tagPageMap.get(tag) || new Set();
            const pageNodes = Array.from(pages).sort().map(pageName => ({ data: { name: pageName, title: pageName.includes('/') ? pageName.substring(pageName.lastIndexOf('/') + 1) : pageName, nodeType: "page", } as PageNodeData, nodes: [], }));
            newNode = { data: { name: currentPath, title: title, nodeType: "tag", pageCount: tagCounts[tag] || 0, } as TagNodeData, nodes: pageNodes, };
          } else {
            newNode = { data: { name: currentPath, title: title, nodeType: "folder", } as FolderNodeData, nodes: [], };
          }

          parent.nodes.push(newNode);
          // Sort siblings using the corrected logic when adding a new node
          parent.nodes.sort((a, b) => {
                // *** USE CORRECTED SORT LOGIC HERE ***
                const typeOrder = { folder: 0, tag: 0, page: 1 }; // Group folder & tag
                const aType = a.data.nodeType;
                const bType = b.data.nodeType;
                const aOrder = typeOrder[aType as keyof typeof typeOrder] ?? 99;
                const bOrder = typeOrder[bType as keyof typeof typeOrder] ?? 99;

                if (aOrder !== bOrder) {
                  // Sort by type: folders/tags first (order 0), then pages (order 1)
                  return aOrder - bOrder;
                } else {
                  // Within the same type, sort alphabetically by title
                  return a.data.title.localeCompare(b.data.title);
                }
          });
          return newNode; // Use new node as parent
        }, root); // Start reduction from the root object
      });

      return {
        nodes: root.nodes,
      };
    }
    

    // --- Imports and type definitions ---
    import { editor, index } from "@silverbulletmd/silverbullet/syscalls";
    import { TagTreeViewConfig } from "./config.ts";
    export interface TagIndexEntry { name: string; page: string; [key: string]: any; }
    type PageNodeData = { name: string; title: string; nodeType: "page"; };
    type FolderNodeData = { name: string; title: string; nodeType: "folder"; };
    type TagNodeData = { name: string; title: string; nodeType: "tag"; pageCount: number; };
    type NodeData = FolderNodeData | TagNodeData | PageNodeData;
    export type TreeNode = { data: NodeData; nodes: TreeNode[]; };

    /** Leaf name of a (possibly slash-separated) page path. */
    function pageTitle(pageName: string): string {
      return pageName.includes("/")
        ? pageName.substring(pageName.lastIndexOf("/") + 1)
        : pageName;
    }

    /** Sort comparator: direct pages before child tags, then alphabetical by title. */
    function compareNodes(a: TreeNode, b: TreeNode): number {
      const typeOrder = { page: 0, folder: 1, tag: 1 } as const;
      const aOrder = typeOrder[a.data.nodeType as keyof typeof typeOrder] ?? 99;
      const bOrder = typeOrder[b.data.nodeType as keyof typeof typeOrder] ?? 99;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.data.title.localeCompare(b.data.title);
    }

    /** Recursively sort a node's children in place. */
    function sortTree(nodes: TreeNode[]) {
      nodes.sort(compareNodes);
      for (const node of nodes) sortTree(node.nodes);
    }

    export async function getTagTree(_config: TagTreeViewConfig): Promise<{ nodes: TreeNode[] }> {
      // Fetch flat tag index entries.
      let tagIndexEntries: TagIndexEntry[] = [];
      try {
        tagIndexEntries = await index.queryLuaObjects<TagIndexEntry>("tag", {});
      } catch (e: any) {
        console.error("Failed to fetch tags via index.queryLuaObjects('tag',...):", e);
        editor.flashNotification(`Error fetching tags: ${e.message}`, "error");
        return { nodes: [] };
      }

      // Map each unique tag name -> set of pages carrying it.
      const tagPageMap = new Map<string, Set<string>>();
      for (const entry of tagIndexEntries) {
        if (entry && typeof entry.name === "string" && entry.name &&
            typeof entry.page === "string" && entry.page) {
          let pages = tagPageMap.get(entry.name);
          if (!pages) tagPageMap.set(entry.name, pages = new Set<string>());
          pages.add(entry.page);
        } else {
          console.warn("Skipping invalid tag index entry:", entry);
        }
      }

      // Build the tree in a single pass using a per-path node index for O(1)
      // lookups (no per-insertion sorting or linear scans). A node created as an
      // intermediate "folder" is promoted to a "tag" if that path is itself a tag.
      const root: { nodes: TreeNode[] } = { nodes: [] };
      const nodeByPath = new Map<string, TreeNode>();

      for (const tag of tagPageMap.keys()) {
        const parts = tag.split("/");
        let parentNodes = root.nodes;
        let currentPath = "";

        parts.forEach((title, i) => {
          currentPath = i === 0 ? title : `${currentPath}/${title}`;
          const isLeaf = i === parts.length - 1;

          let node = nodeByPath.get(currentPath);
          if (!node) {
            node = {
              data: isLeaf
                ? { name: currentPath, title, nodeType: "tag", pageCount: 0 } as TagNodeData
                : { name: currentPath, title, nodeType: "folder" } as FolderNodeData,
              nodes: [],
            };
            nodeByPath.set(currentPath, node);
            parentNodes.push(node);
          } else if (isLeaf && node.data.nodeType === "folder") {
            // Promote an existing intermediate folder to a tag leaf.
            node.data = { name: currentPath, title, nodeType: "tag", pageCount: 0 } as TagNodeData;
          }

          if (isLeaf) {
            const pages = tagPageMap.get(tag)!;
            (node.data as TagNodeData).pageCount = pages.size;
            const existing = new Set(node.nodes.map((n) => n.data.name));
            for (const pageName of pages) {
              if (!existing.has(pageName)) {
                node.nodes.push({
                  data: { name: pageName, title: pageTitle(pageName), nodeType: "page" } as PageNodeData,
                  nodes: [],
                });
              }
            }
          }
          parentNodes = node.nodes;
        });
      }

      // Single recursive sort pass at the end.
      sortTree(root.nodes);
      return { nodes: root.nodes };
    }

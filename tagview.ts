import { editor, system } from "@silverbulletmd/silverbullet/syscalls";
import { PLUG_DISPLAY_NAME, TagTreeViewConfig } from "./config.ts";

// --- Type Definitions ---
interface PageQueryResult {
  name: string;
  tags?: string[]; // Tags can be optional
  [key: string]: any;
}

type PageNodeData = { name: string; title: string; nodeType: "page"; };
type FolderNodeData = { name: string; title: string; nodeType: "folder"; };
type TagNodeData = { name: string; title: string; nodeType: "tag"; pageCount: number; };
type NodeData = FolderNodeData | TagNodeData | PageNodeData;

export type TreeNode = { data: NodeData; nodes: TreeNode[]; };

// --- Panel Control Functions (as defined in YAML) ---

export async function showTagView() {
  const config = await system.invokeFunction("config.get", PLUG_DISPLAY_NAME) as TagTreeViewConfig;
  const panelHtml = `
    <div class="sb-tag-view-root">
      <div class="sb-tag-view-header">
        <span class="sb-tag-view-title">${PLUG_DISPLAY_NAME}</span>
      </div>
      <div class="sb-tag-view-tree" style="overflow: auto; flex-grow: 1;">
        {{#if @loading}}
          <div class="sb-tag-view-loading">Loading...</div>
        {{else}}
          {{#render tree}}
        {{/if}}
      </div>
    </div>`;

  // The data source string now correctly calls the exported getTagTree function
  const panelDataSource = `return system.invokeFunction("tagview.getTagTree");`;

  await editor.showPanel("left", config.panelSize, panelHtml, panelDataSource);
}

export async function hideTagView() {
  await editor.hidePanel("left");
}

export async function toggleTagView() {
    // This is a simplified toggle; for a true toggle, you'd need to check if the panel is visible.
    // However, calling showPanel is often sufficient as it will create or focus the panel.
    await showTagView();
}

export async function showTagViewIfEnabled() {
  const config = await system.invokeFunction("config.get", PLUG_DISPLAY_NAME) as TagTreeViewConfig;
  if (config.showOnStartup) {
    await showTagView();
  }
}

// --- Data Fetching Function (as defined in YAML) ---

export async function getTagTree(): Promise<{ nodes: TreeNode[] }> {
  let allPages: PageQueryResult[] = [];
  try {
    // Using the correct v2 API call
    allPages = await system.invokeFunction("index.queryObjects", "page", {});
  } catch (e) {
    console.error("Failed to fetch pages via index.queryObjects('page', {}):", e);
    editor.flashNotification(`Error fetching pages: ${e.message}`, "error");
    return { nodes: [] };
  }

  const tagPageMap = new Map<string, Set<string>>();
  for (const page of allPages) {
    if (page && Array.isArray(page.tags) && typeof page.name === "string" && page.name) {
      for (const tagName of page.tags) {
        if (!tagPageMap.has(tagName)) {
          tagPageMap.set(tagName, new Set<string>());
        }
        tagPageMap.get(tagName)!.add(page.name);
      }
    }
  }

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

      if (node) {
        if (isLeafTagNode && node.data.nodeType === "folder") {
          node.data = { name: currentPath, title: title, nodeType: "tag", pageCount: tagCounts[tag] || 0 };
          const pages = tagPageMap.get(tag) || new Set();
          const existingPageNames = new Set(node.nodes.map(n => n.data.name));
          const newPageNodes = Array.from(pages).filter(pageName => !existingPageNames.has(pageName)).sort().map(pageName => ({ data: { name: pageName, title: pageName.includes('/') ? pageName.substring(pageName.lastIndexOf('/') + 1) : pageName, nodeType: "page" } as PageNodeData, nodes: [] }));
          node.nodes.push(...newPageNodes);
        } else if (isLeafTagNode && node.data.nodeType === "tag") {
           if (node.nodes.filter(n => n.data.nodeType === 'page').length === 0) {
                const pages = tagPageMap.get(tag) || new Set();
                const pageNodes = Array.from(pages).sort().map(pageName => ({ data: { name: pageName, title: pageName.includes('/') ? pageName.substring(pageName.lastIndexOf('/') + 1) : pageName, nodeType: "page" } as PageNodeData, nodes: [] }));
                node.nodes.push(...pageNodes);
           }
           (node.data as TagNodeData).pageCount = tagCounts[tag] || 0;
        }
        node.nodes.sort((a, b) => {
            const typeOrder = { folder: 0, tag: 0, page: 1 };
            const aType = a.data.nodeType; const bType = b.data.nodeType;
            const aOrder = typeOrder[aType as keyof typeof typeOrder] ?? 99;
            const bOrder = typeOrder[bType as keyof typeof typeOrder] ?? 99;
            if (aOrder !== bOrder) return aOrder - bOrder;
            return a.data.title.localeCompare(b.data.title);
        });
        return node;
      }

      let newNode: TreeNode;
      if (isLeafTagNode) {
        const pages = tagPageMap.get(tag) || new Set();
        const pageNodes = Array.from(pages).sort().map(pageName => ({ data: { name: pageName, title: pageName.includes('/') ? pageName.substring(pageName.lastIndexOf('/') + 1) : pageName, nodeType: "page" } as PageNodeData, nodes: [] }));
        newNode = { data: { name: currentPath, title: title, nodeType: "tag", pageCount: tagCounts[tag] || 0 } as TagNodeData, nodes: pageNodes };
      } else {
        newNode = { data: { name: currentPath, title: title, nodeType: "folder" } as FolderNodeData, nodes: [] };
      }

      parent.nodes.push(newNode);
      parent.nodes.sort((a, b) => {
            const typeOrder = { folder: 0, tag: 0, page: 1 };
            const aType = a.data.nodeType;
            const bType = b.data.nodeType;
            const aOrder = typeOrder[aType as keyof typeof typeOrder] ?? 99;
            const bOrder = typeOrder[bType as keyof typeof typeOrder] ?? 99;
            if (aOrder !== bOrder) {
              return aOrder - bOrder;
            } else {
              return a.data.title.localeCompare(b.data.title);
            }
      });
      return newNode;
    }, root);
  });

  return { nodes: root.nodes };
}// tagview.ts

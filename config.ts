import {
  clientStore,
  config,
  editor,
} from "@silverbulletmd/silverbullet/syscalls";

// Keep PLUG_NAME and PLUG_DISPLAY_NAME
export const PLUG_NAME = "treeview";
export const PLUG_DISPLAY_NAME = "Tag TreeView Plug";

const ENABLED_STATE_KEY = "enableTreeView"; // Panel visibility state
const VIEW_STATE_KEY = "treeViewLastView"; // Last active view ("tags" | "outline")

// Positions remain the same
const POSITIONS = ["rhs", "lhs", "bhs", "modal"] as const;
export type Position = typeof POSITIONS[number];

export type ViewType = "tags" | "outline";

export interface TagTreeViewConfig {
  /** Where to position the tree view in the UI. */
  position: Position;
  /** The flex size of the treeview pane (maps to CSS `flex`). */
  size: number;
}

const DEFAULT_CONFIG: TagTreeViewConfig = { position: "lhs", size: 1 };

/**
 * Validates/coerces raw config into a TagTreeViewConfig, falling back to
 * defaults for any missing or invalid fields. Replaces the previous Zod schema
 * (which accounted for ~half the compiled plug size) with a tiny total parser.
 */
function parseConfig(raw: unknown): TagTreeViewConfig {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const position = POSITIONS.includes(obj.position as Position)
    ? (obj.position as Position)
    : DEFAULT_CONFIG.position;
  const size = typeof obj.size === "number" && obj.size > 0
    ? obj.size
    : DEFAULT_CONFIG.size;
  return { position, size };
}

export async function getPlugConfig(): Promise<TagTreeViewConfig> {
  try {
    const userConfig = await config.get("treeview", {});
    return parseConfig(userConfig);
  } catch (err) {
    console.error(`${PLUG_DISPLAY_NAME}: failed to read config`, err);
    await editor.flashNotification(
      `There was an error reading your ${PLUG_DISPLAY_NAME} configuration. Check your CONFIG page.`,
      "error",
    );
    return { ...DEFAULT_CONFIG };
  }
}

export async function isTreeViewEnabled() {
  return !!(await clientStore.get(ENABLED_STATE_KEY));
}

export async function setTreeViewEnabled(value: boolean) {
  return await clientStore.set(ENABLED_STATE_KEY, value);
}

export async function getLastView(): Promise<ViewType> {
  return (await clientStore.get(VIEW_STATE_KEY)) === "outline"
    ? "outline"
    : "tags";
}

export async function setLastView(value: ViewType) {
  return await clientStore.set(VIEW_STATE_KEY, value);
}

export async function getCustomStyles() {
  const customStyles = await editor.getUiOption("customStyles") as
    | string
    | undefined;
  return customStyles;
}

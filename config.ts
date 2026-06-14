import {
  clientStore,
  config,
  editor,
} from "@silverbulletmd/silverbullet/syscalls";

// Keep PLUG_NAME and PLUG_DISPLAY_NAME
export const PLUG_NAME = "treeview";
export const PLUG_DISPLAY_NAME = "Tag TreeView Plug";
// Single source of truth for the version reported by the "Tag Tree: Version"
// command. Keep in sync with package.json, treeview.plug.yaml and PLUG.md.
export const PLUG_VERSION = "0.22.0";

const ENABLED_STATE_KEY = "enableTreeView"; // Panel visibility state

// Positions remain the same
const POSITIONS = ["rhs", "lhs", "bhs", "modal"] as const;
export type Position = typeof POSITIONS[number];

export interface TagTreeViewConfig {
  /** Where to position the tree view in the UI. */
  position: Position;
  /** The flex size of the treeview pane (maps to CSS `flex`). */
  size: number;
  /** Page-path prefixes to exclude from the synthetic `.notag` listing
   * (e.g. `["Clippings/"]`). Pages matching any prefix are still indexed
   * normally under their tags; they're just omitted from `.notag`. */
  notagIgnore: string[];
}

const DEFAULT_CONFIG: TagTreeViewConfig = {
  position: "lhs",
  size: 1,
  notagIgnore: [],
};

// Only notify about config problems once per "breakage episode" so a bad value
// doesn't flash an error on every refresh; reset when config parses cleanly.
let configErrorShown = false;
function notifyConfigErrors(errors: string[]) {
  if (configErrorShown) return;
  configErrorShown = true;
  void editor.flashNotification(
    `${PLUG_DISPLAY_NAME} config: ${errors.join("; ")}. Check your CONFIG page.`,
    "error",
  );
}

/**
 * Validates/coerces raw config into a TagTreeViewConfig, falling back to
 * defaults for any invalid field and reporting which field was wrong. Replaces
 * the previous Zod schema (which accounted for ~half the compiled plug size)
 * with a tiny total parser that still surfaces per-field diagnostics.
 */
function parseConfig(raw: unknown): TagTreeViewConfig {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const errors: string[] = [];

  let position = DEFAULT_CONFIG.position;
  if (obj.position !== undefined) {
    if (POSITIONS.includes(obj.position as Position)) {
      position = obj.position as Position;
    } else {
      errors.push(
        `\`position\` must be one of ${POSITIONS.join(", ")} (got ${
          JSON.stringify(obj.position)
        })`,
      );
    }
  }

  let size = DEFAULT_CONFIG.size;
  if (obj.size !== undefined) {
    if (typeof obj.size === "number" && obj.size > 0) {
      size = obj.size;
    } else {
      errors.push(`\`size\` must be a number > 0 (got ${JSON.stringify(obj.size)})`);
    }
  }

  let notagIgnore = DEFAULT_CONFIG.notagIgnore;
  if (obj.notagIgnore !== undefined) {
    if (
      Array.isArray(obj.notagIgnore) &&
      obj.notagIgnore.every((p) => typeof p === "string")
    ) {
      notagIgnore = obj.notagIgnore as string[];
    } else {
      errors.push(
        `\`notagIgnore\` must be an array of strings (got ${
          JSON.stringify(obj.notagIgnore)
        })`,
      );
    }
  }

  if (errors.length > 0) {
    notifyConfigErrors(errors);
  } else {
    configErrorShown = false; // config is clean again; re-arm notifications
  }
  return { position, size, notagIgnore };
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

export async function getCustomStyles() {
  const customStyles = await editor.getUiOption("customStyles") as
    | string
    | undefined;
  return customStyles;
}

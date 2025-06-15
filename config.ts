import {
  clientStore,
  editor,
  system,
} from "@silverbulletmd/silverbullet/syscalls";
import { z, ZodError } from "zod";

// Keep PLUG_NAME and PLUG_DISPLAY_NAME (maybe update display name)
export const PLUG_NAME = "treeview"; // Or rename to "tagtreeview"? Keep for compatibility for now.
export const PLUG_DISPLAY_NAME = "Tag TreeView Plug"; // Updated display name

const ENABLED_STATE_KEY = "enableTreeView"; // Keep key for enable/disable state
const OUTLINE_ENABLED_STATE_KEY = "enableOutlineView"; // Key for outline view state

// Positions remain the same
const POSITIONS = ["rhs", "lhs", "bhs", "modal"] as const;
export type Position = typeof POSITIONS[number];

// Remove or comment out page exclusion schemas as they don't apply to listing tags
/*
export const exclusionRuleByRegexSchema = z.object({ ... });
export const exclusionRuleByTagsSchema = z.object({ ... });
export const exclusionRuleByFunctionSchema = z.object({ ... });
*/

const tagTreeViewConfigSchema = z.object({
  /**
   * Where to position the tree view in the UI.
   */
  position: z.enum(POSITIONS).optional().default("lhs"),

  /**
   * The size of the treeview pane.
   */
  size: z.number().gt(0).optional().default(1),

  /**
   * Drag-and-drop options - Disabled for tags as it's not applicable.
   */
  // dragAndDrop: z.object({ ... }).optional().default({ enabled: false }), // Commented out or simplified

  /**
   * @deprecated - pageExcludeRegex removed as it's page-specific
   */
  // pageExcludeRegex: z.string().optional().default(""),

  /**
   * @deprecated - exclusions removed as they are page-specific
   */
  // exclusions: z.array(z.discriminatedUnion("type", [ ... ])).optional(),

  // Potential future config: options for sorting tags, filtering tags?
});

// Update Type Alias
export type TagTreeViewConfig = z.infer<typeof tagTreeViewConfigSchema>;

// Keep showConfigErrorNotification function (adapting message slightly if needed)
let configErrorShown = false;
async function showConfigErrorNotification(error: unknown) {
  if (configErrorShown) {
    return;
  }
  configErrorShown = true;
  let errorMessage = `${typeof error}: ${String(error)}`;
  if (error instanceof ZodError) {
    const { formErrors, fieldErrors } = error.flatten();
    const fieldErrorMessages = Object.keys(fieldErrors).map((field) =>
      `\`${field}\` - ${fieldErrors[field]!.join(", ")}`
    );
    errorMessage = [...formErrors, ...fieldErrorMessages].join("; ");
  }
  await editor.flashNotification(
    `There was an error with your ${PLUG_DISPLAY_NAME} configuration. Check your SETTINGS file: ${errorMessage}`, // Updated plug name
    "error",
  );
}


// Update getPlugConfig to use the new schema and provide defaults
export async function getPlugConfig(): Promise<TagTreeViewConfig> {
  const userConfig = await system.getSpaceConfig("treeview", {}); // Read from 'treeview' key for now

  try {
    // Use the new schema
    return tagTreeViewConfigSchema.parse(userConfig || {});
  } catch (_err) {
    if (!configErrorShown) {
      showConfigErrorNotification(_err);
      configErrorShown = true;
    }
    // Fallback to the default configuration using the new schema
    return tagTreeViewConfigSchema.parse({});
  }
}

// Keep isTreeViewEnabled, setTreeViewEnabled, getCustomStyles as they are general UI state/options
export async function isTreeViewEnabled() {
  return !!(await clientStore.get(ENABLED_STATE_KEY));
}

export async function setTreeViewEnabled(value: boolean) {
  return await clientStore.set(ENABLED_STATE_KEY, value);
}

export async function isOutlineViewEnabled() {
  return !!(await clientStore.get(OUTLINE_ENABLED_STATE_KEY));
}

export async function setOutlineViewEnabled(value: boolean) {
  return await clientStore.set(OUTLINE_ENABLED_STATE_KEY, value);
}

export async function getCustomStyles() {
  const customStyles = await editor.getUiOption("customStyles") as
    | string
    | undefined;
  return customStyles;
}

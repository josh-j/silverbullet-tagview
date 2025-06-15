// config.ts

import { editor, system } from "@silverbulletmd/silverbullet/syscalls";
import { z, ZodError } from "zod";

/**
 * The key used to identify the plug's settings in your CONFIG.md.
 * This MUST match the key in your `config.set` block.
 * e.g., `config.set { tagview = { ... } }`
 */
export const PLUG_NAME = "tagview";

/**
 * The user-friendly name shown in the UI.
 */
export const PLUG_DISPLAY_NAME = "Tag View";

/**
 * Defines the structure and default values for the plug's configuration.
 * This is the "contract" for what the settings should look like.
 */
const tagViewConfigSchema = z.object({
  /**
   * Where to position the tree view in the UI.
   * Can be "lhs" (left), "rhs" (right), "bhs" (bottom), or "modal".
   */
  position: z.enum(["lhs", "rhs", "bhs", "modal"]).optional().default("lhs"),

  /**
   * The size (width for side panels, height for bottom) of the treeview pane in pixels.
   */
  size: z.number().gt(0).optional().default(320),
});

// This creates a TypeScript type from our schema.
export type TagViewConfig = z.infer<typeof tagViewConfigSchema>;

/**
 * A reliable, validated function to get the plug's configuration.
 * It reads from the space configuration, validates it, and applies defaults.
 */
export async function getPlugConfig(): Promise<TagViewConfig> {
  // Get the config object from the space, using PLUG_NAME as the key.
  const userConfig = await system.getSpaceConfig(PLUG_NAME, {});

  try {
    // Parse the user's config. If any values are missing, Zod applies the defaults.
    return tagViewConfigSchema.parse(userConfig || {});
  } catch (e) {
    // If the config is invalid, show an error and return the default settings.
    console.error(`Error parsing ${PLUG_DISPLAY_NAME} config:`, e);
    await editor.flashNotification(
      `Invalid configuration for ${PLUG_DISPLAY_NAME}, using defaults.`,
      "error",
    );
    // Fallback to a completely default configuration on error.
    return tagViewConfigSchema.parse({});
  }
}

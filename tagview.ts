// tagview.ts

import { editor, system } from "@silverbulletmd/silverbullet/syscalls";
import { getPlugConfig, PLUG_DISPLAY_NAME } from "./config.ts";
import { getTagTree } from "./api.ts"; // We will call this from the plug manifest

/**
 * Shows the tag view panel. This function is called by the toggle command
 * and on startup events if configured.
 */
export async function showTagView() {
  // Use our robust helper function to get the validated configuration.
  const config = await getPlugConfig();

  // Define the HTML for the panel.
  const panelHtml = `
    <div class="sb-tag-view-root">
      <div class="sb-tag-view-header">
        <span class="sb-tag-view-title">${PLUG_DISPLAY_NAME}</span>
      </div>
      <div class="sb-tag-view-tree" style="overflow: auto; flex-grow: 1;">
        <!-- Silverbullet's template engine will show this while the data source is loading -->
        {{#if @loading}}
          <div class="sb-tag-view-loading">Loading...</div>
        {{else}}
          <!-- Once loaded, the 'tree' data is passed to the render helper -->
          {{#render tree}}
        {{/if}}
      </div>
    </div>`;

  /**
   * Define the data source for the panel.
   * This tells Silverbullet: "To get the data for this panel, run the function
   * named 'tagview.getTagTree' from the plug manifest."
   * We moved the getTagTree function into api.ts, so we just reference it here.
   */
  const panelDataSource = `return system.invokeFunction("tagview.getTagTree");`;

  // Display the panel using the position and size from our configuration.
  await editor.showPanel(config.position, config.size, panelHtml, panelDataSource);
}

/**
 * Hides the left-hand side panel.
 */
export async function hideTagView() {
  // Note: This assumes the panel is on the left. A more advanced version
  // might read config.position to hide the correct panel.
  await editor.hidePanel("lhs");
}

/**
 * Command function to toggle the panel's visibility.
 * For simplicity, this just calls showTagView. A true toggle would require
 * checking if the panel is already visible.
 */
export async function toggleTagView() {
  await showTagView();
}

/**
 * This function runs on editor events (like startup) and shows the
 * panel only if the user has enabled it in their settings.
 */
export async function showTagViewIfEnabled() {
  const config = await getPlugConfig();
  if (config.showOnStartup) { // Assuming you add this to your config schema
    await showTagView();
  }
}

import { Plugin, TFile } from "obsidian";
import { applyWorkspacePatches } from "./src/patch-workspace";
import { applyEditorSuggestPatches } from "./src/patch-editor-suggest";
import { debugLog, DEBUG_ENABLED } from "./src/debug";
import { IndexCache } from "./src/index-cache";
import type { GfmHeadingLinksPlugin } from "./src/resolve-target";

/**
 * Main plugin class for GFM Heading Links.
 * 
 * This plugin intercepts Obsidian's native link resolution and editor suggestions
 * to allow users to use GitHub Flavored Markdown (GFM) standard slugs (e.g., `#my-heading`)
 * in their markdown links, instead of Obsidian's proprietary heading format (`#My Heading`).
 */
export default class GfmHeadingLinksPluginImpl extends Plugin implements GfmHeadingLinksPlugin {
  /**
   * Array of cleanup functions returned by our monkey-patches.
   * These functions restore Obsidian's native logic when the plugin is unloaded.
   */
  private cleanupFunctions: (() => void)[] = [];

  /**
   * The central cache responsible for tracking markdown headings across the vault
   * and mapping GFM slugs back to their original text and line numbers.
   */
  public indexCache!: IndexCache;

  /**
   * Initializes the plugin when it is enabled by the user.
   * 
   * Note on patching:
   * We pass `this` (the plugin instance) to standalone functions like `applyWorkspacePatches(this)`.
   * Because those functions are defined in separate files, they need this reference to access Obsidian's API.
   * 
   * These patching functions execute their injections immediately and RETURN a "cleanup function" definition.
   * By pushing these returned functions into our `cleanupFunctions` array, we are saving the 
   * restoration instructions on a shelf. The cleanup code does not run yet.
   */
  async onload() {
    this.indexCache = new IndexCache(this);

    /**
     * File Modification Listener
     * Triggers whenever a file's content changes. We invalidate that file in our cache
     * so that any edited, added, or removed headings are immediately reflected.
     */
    this.registerEvent(
      this.app.metadataCache.on("changed", (file: TFile) => {
        this.indexCache.invalidate(file);
      })
    );

    /**
     * File Rename Listener
     * Triggers when a file is moved or renamed. We update the cache's references
     * so it tracks the new path instead of the old, stale path.
     */
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (file instanceof TFile) {
          this.indexCache.invalidateRename(oldPath, file.path);
        }
      })
    );

    /**
     * File Deletion Listener
     * Triggers when a file is permanently removed or moved to trash.
     * We purge its data from our cache to free up memory.
     */
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof TFile) {
          this.indexCache.invalidate(file);
        }
      })
    );

    // applyWorkspacePatches injects our custom logic into Obsidian's workspace and returns a cleanup function.
    // We save this returned cleanup function into our cleanupFunctions array.
    const workspaceCleanup = applyWorkspacePatches(this);
    this.cleanupFunctions.push(workspaceCleanup);
    
    // Defer the editor suggest patch slightly to ensure Obsidian's native suggestors are loaded
    setTimeout(() => {
      const editorSuggestCleanup = applyEditorSuggestPatches(this);
      this.cleanupFunctions.push(editorSuggestCleanup);
    }, 1000);
  }

  /**
   * Cleans up the plugin when it is disabled to prevent memory leaks and restore native behavior.
   * 
   * This method iterates through the `cleanupFunctions` array and actually executes each one.
   * Running these functions restores the backups of Obsidian's original logic. 
   * Finally, we set the array to empty to release the closures from memory (Garbage Collection).
   */
  onunload() {
    // Loop through and execute all cleanup functions (workspace patches, editor patches, etc.)
    // that were pushed to the cleanupFunctions array during onload.
    // This undoes our monkey-patches and restores Obsidian's native logic.
    this.cleanupFunctions.forEach((cleanup) => cleanup());
    // Clear the array to prevent memory leaks and accidental double-execution
    this.cleanupFunctions = [];
  }
}

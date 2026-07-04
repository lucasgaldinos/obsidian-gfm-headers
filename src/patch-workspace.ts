import { Plugin } from "obsidian";
import { resolveGfmSlug } from "./gfm-slugify";

/**
 * Monkeypatches Obsidian's core Workspace router to globally intercept and
 * rewrite GitHub Flavored Markdown (GFM) kebab-case anchor links into the
 * exact-case headings that Obsidian natively expects.
 *
 * This bypasses the need for complex, fragile CodeMirror 6 ViewPlugins or
 * DOM Mutation Observers, ensuring native behavior (including modifier keys
 * like `Ctrl+Hover`) remains completely intact.
 *
 * @param plugin - The Obsidian plugin instance.
 * @returns A teardown function to restore the original Workspace methods.
 */
export function patchWorkspace(plugin: Plugin): () => void {
  const workspace = plugin.app.workspace;
  
  // ── Patch trigger("hover-link") ──────────────────────────────
  
  /**
   * Intercept `workspace.trigger` to catch the `'hover-link'` event before
   * the Page Preview core plugin attempts to resolve it.
   */
  const originalTrigger = workspace.trigger;
  workspace.trigger = function (name: string, ...args: any[]) {
    if (name === "hover-link" && args.length > 0) {
      try {
        const data = args[0];
        if (data && typeof data.linktext === "string") {
          let linktext: string = data.linktext;
          const hashIdx = linktext.indexOf("#");
          if (hashIdx !== -1) {
            const notePath = linktext.substring(0, hashIdx);
            const slug = linktext.substring(hashIdx + 1);
            
            if (slug.includes("-") && !/[A-Z]/.test(slug)) {
              let sourcePath = "";
              if (data.sourcePath) {
                 sourcePath = data.sourcePath;
              } else if (data.hoverParent && data.hoverParent.file && data.hoverParent.file.path) {
                 sourcePath = data.hoverParent.file.path;
              } else {
                 sourcePath = plugin.app.workspace.getActiveFile()?.path ?? "";
              }
              
              const resolved = resolveGfmSlug(plugin, notePath, slug, sourcePath);
              if (resolved) {
                data.linktext = notePath + "#" + resolved;
              }
            }
          }
        }
      } catch (err) {
        console.error("[GFM Heading Links] Error in hover-link patch:", err);
      }
    }
    return originalTrigger.call(this, name, ...args);
  };

  // ── Patch openLinkText ─────────────────────────────────────────
  
  /**
   * Intercept `workspace.openLinkText` to catch physical clicks and
   * programmatic navigations across the entire application.
   */
  const originalOpenLinkText = workspace.openLinkText;
  workspace.openLinkText = function (
    linktext: string,
    sourcePath: string,
    ...rest: any[]
  ) {
    try {
      if (typeof linktext === "string") {
        const hashIdx = linktext.indexOf("#");
        if (hashIdx !== -1) {
          const notePath = linktext.substring(0, hashIdx);
          const slug = linktext.substring(hashIdx + 1);
          
          if (slug.includes("-") && !/[A-Z]/.test(slug)) {
            const resolved = resolveGfmSlug(plugin, notePath, slug, sourcePath);
            if (resolved) {
              linktext = notePath + "#" + resolved;
            }
          }
        }
      }
    } catch (err) {
      console.error("[GFM Heading Links] Error in openLinkText patch:", err);
    }
    return originalOpenLinkText.call(this, linktext, sourcePath, ...rest);
  };
  
  return () => {
    workspace.trigger = originalTrigger;
    workspace.openLinkText = originalOpenLinkText;
  };
}
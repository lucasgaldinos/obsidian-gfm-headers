/**
 * Link Click Interceptor — GFM Slug Resolution for Navigation.
 *
 * This module monkeypatches Obsidian's `workspace.openLinkText` to intercept
 * link clicks and resolve GFM heading slugs. It uses the async resolution
 * pipeline (which includes HTML anchor scanning via `vault.read()`) and
 * delegates to Obsidian's native block navigation via virtual block injection.
 *
 * ## Architecture
 *
 * This file was extracted from `patch-workspace.ts` per TASK-1007 (SRP).
 * The hover preview interceptor is now in `patch-link-hover.ts`.
 * Both share the `injectVirtualBlock()` utility from `virtual-block.ts`
 * and the `resolveGfmTarget()` / `resolveGfmTargetSync()` functions from
 * `resolve-target.ts`.
 *
 * ## Data flow
 *
 * ```
 * User clicks [[Note#my-heading]]
 *   → workspace.openLinkText("Note.md#my-heading", sourcePath)
 *   → resolveGfmTarget(plugin, "Note.md", "my-heading", sourcePath)
 *   → IndexCache.get(file) → DocumentIndex
 *   → HeadingAnchorTarget found
 *   → injectVirtualBlock(cache, slug, position, "gfm-click-")
 *   → originalOpenLinkText("Note.md#^gfm-click-my-heading", ...)
 *   → Obsidian native block navigation → scroll + highlight
 *   → cleanup: delete virtual block after 1500ms
 * ```
 */

import { MarkdownView } from "obsidian";
import { resolveGfmTarget, type GfmHeadingLinksPlugin } from "./resolve-target";
import { revealTargetInView } from "./reveal-target";
import { debugLog } from "./debug";
import { injectVirtualBlock } from "./virtual-block";

/**
 * Applies the `openLinkText` monkeypatch for GFM heading link click navigation.
 *
 * @param plugin - The main GfmHeadingLinksPlugin instance containing the IndexCache.
 * @returns A cleanup function that restores the original `openLinkText` method.
 *          Must be called during the plugin's `onunload` lifecycle.
 */
export function applyClickPatch(plugin: GfmHeadingLinksPlugin): () => void {
    const workspace = plugin.app.workspace;
    const originalOpenLinkText = workspace.openLinkText;

    workspace.openLinkText = async function (
        linktext: string,
        sourcePath: string,
        newLeaf?: any,
        openViewState?: any
    ) {
        try {
            if (typeof linktext === "string") {
                const hashIdx = linktext.indexOf("#");
                if (hashIdx !== -1) {
                    const notePath = linktext.substring(0, hashIdx);
                    const slug = linktext.substring(hashIdx + 1);

                    // Resolve the GFM slug via our custom cache
                    const targetResolution = await resolveGfmTarget(plugin, notePath, slug, sourcePath);

                    if (targetResolution.type === "success" && targetResolution.target && targetResolution.file) {
                        if (targetResolution.target.type === "heading") {
                            // Virtual Block Injection for native highlighting
                            const cache = plugin.app.metadataCache.getFileCache(targetResolution.file);
                            if (cache) {
                                injectVirtualBlock(cache, targetResolution.target.slug, targetResolution.target.position, "gfm-click-");

                                // Delegate back to Obsidian with the virtual block
                                const virtualId = `gfm-click-${targetResolution.target.slug}`;
                                const targetLinktext = notePath ? `${notePath}#^${virtualId}` : `#^${virtualId}`;
                                const res = await originalOpenLinkText.call(this, targetLinktext, sourcePath, newLeaf, openViewState);

                                return res;
                            }
                        }

                        // Fallback manual reveal (HTML Anchors or if cache fails)
                        await originalOpenLinkText.call(this, targetResolution.file.path, sourcePath, newLeaf, openViewState);

                        // Find the view and scroll to the target line
                        const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
                        if (view && view.file?.path === targetResolution.file.path) {
                            revealTargetInView(view, targetResolution.target);
                        } else {
                            // Search all leaves for background tabs
                            const leaves = plugin.app.workspace.getLeavesOfType("markdown");
                            for (const leaf of leaves) {
                                if (leaf.view instanceof MarkdownView && leaf.view.file?.path === targetResolution.file.path) {
                                    revealTargetInView(leaf.view, targetResolution.target);
                                    break;
                                }
                            }
                        }
                        return;
                    }
                }
            }
        } catch (err) {
            console.error("[GFM Heading Links] Error in openLinkText patch:", err);
        }

        // Passthrough to native handler
        return originalOpenLinkText.call(this, linktext, sourcePath, newLeaf, openViewState);
    };

    return () => {
        workspace.openLinkText = originalOpenLinkText;
    };
}

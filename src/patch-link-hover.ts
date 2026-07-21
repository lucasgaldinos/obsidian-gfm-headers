/**
 * Hover Preview Interceptor — GFM Slug Resolution for Page Preview.
 *
 * This module monkeypatches Obsidian's `workspace.trigger('hover-link')` to
 * intercept hover events and resolve GFM heading slugs for the native Page
 * Preview popover. It uses the synchronous resolution path (no disk I/O for
 * HTML anchors — the hover event must mutate the payload before Obsidian
 * processes it) and delegates to Obsidian's native preview renderer via
 * virtual block injection.
 *
 * ## Architecture
 *
 * This file was extracted from `patch-workspace.ts` per TASK-1007 (SRP).
 * The click navigation interceptor is now in `patch-link-click.ts`.
 * Both share the `injectVirtualBlock()` utility from `virtual-block.ts`.
 *
 * ## Why synchronous?
 *
 * Obsidian's `trigger('hover-link')` event expects the payload to be mutated
 * synchronously. Using `await vault.read()` would return AFTER the event has
 * already been processed by the native hover plugin. The `resolveGfmTargetSync()`
 * function handles this constraint by using only the in-memory metadata cache
 * (no HTML anchor scanning, which requires file I/O).
 *
 * ## Data flow
 *
 * ```
 * User hovers over [[Note#my-heading]]
 *   → workspace.trigger("hover-link", { linktext: "Note.md#my-heading", ... })
 *   → isGfmSlug("my-heading") → true
 *   → resolveGfmTargetSync(plugin, "Note.md", "my-heading", sourcePath)
 *   → buildDocumentIndex(cache) → DocumentIndex
 *   → HeadingAnchorTarget found
 *   → injectVirtualBlock(cache, slug, position, "gfm-")
 *   → data.linktext = "Note.md#^gfm-my-heading"
 *   → originalTrigger("hover-link", mutatedPayload)
 *   → Obsidian native Page Preview renders the block
 *   → cleanup: delete virtual block after 1500ms
 * ```
 */

import { resolveGfmTargetSync, type GfmHeadingLinksPlugin } from "./resolve-target";
import { debugLog } from "./debug";
import { isGfmSlug } from "./gfm-slugify";
import { injectVirtualBlock } from "./virtual-block";

/** Shape of the event payload emitted by Obsidian's hover-link trigger. */
interface HoverEventPayload {
    linktext?: string;
    sourcePath?: string;
    hoverParent?: { file?: { path?: string } };
}

/**
 * Applies the `trigger('hover-link')` monkeypatch for GFM heading link
 * Page Preview hover support.
 *
 * @param plugin - The main GfmHeadingLinksPlugin instance.
 * @returns A cleanup function that restores the original `trigger` method.
 *          Must be called during the plugin's `onunload` lifecycle.
 */
export function applyHoverPatch(plugin: GfmHeadingLinksPlugin): () => void {
    const workspace = plugin.app.workspace;
    const originalTrigger = workspace.trigger.bind(workspace);

    workspace.trigger = (name: string, ...args: unknown[]) => {
        if (name === "hover-link" && args.length > 0) {
            debugLog("patch:hover-link:intercepted", { argCount: args.length });
            try {
                const hoverEventPayload = args[0] as HoverEventPayload | undefined;
                if (hoverEventPayload && typeof hoverEventPayload.linktext === "string") {
                    const linktext: string = hoverEventPayload.linktext;
                    const hashIdx = linktext.indexOf("#");

                    debugLog("patch:hover-link:parsed", { linktext, hashIdx });

                    if (hashIdx !== -1) {
                        const notePath = linktext.substring(0, hashIdx);
                        const slug = linktext.substring(hashIdx + 1);
                        debugLog("patch:hover-link:slug", { slug });

                        if (!isGfmSlug(slug)) {
                            return originalTrigger(name, ...args);
                        }

                        debugLog("patch:hover-link:guard", { isGfmSlug: true });

                        // Find sourcePath from event payload
                        let sourcePath = "";
                        if (hoverEventPayload.sourcePath) {
                            sourcePath = hoverEventPayload.sourcePath;
                        } else if (hoverEventPayload.hoverParent?.file?.path) {
                            sourcePath = hoverEventPayload.hoverParent.file.path;
                        } else {
                            sourcePath = plugin.app.workspace.getActiveFile()?.path ?? "";
                        }
                        debugLog("patch:hover-link:sourcePath", { sourcePath });

                        // Use the synchronous resolver (no disk I/O, no HTML anchors)
                        const result = resolveGfmTargetSync(plugin, notePath, slug, sourcePath);

                        if (result.type === "success" && result.target?.type === "heading" && result.file) {
                            const cache = plugin.app.metadataCache.getFileCache(result.file);
                            if (cache) {
                                // Inject virtual block and rewrite the link text
                                injectVirtualBlock(cache, result.target.slug, result.target.position || {
                                    start: { line: result.target.line, col: 0, offset: 0 },
                                    end: { line: result.target.endLine, col: 0, offset: 0 }
                                }, "gfm-");

                                const virtualId = `gfm-${result.target.slug}`;
                                hoverEventPayload.linktext = `${notePath}#^${virtualId}`;
                                debugLog("reveal:preview-virtual-block", { originalSlug: slug, virtualId });
                            }
                        } else {
                            debugLog("patch:hover-link:target", { found: false, type: result.type });
                        }
                    }
                }
            } catch (err) {
                console.error("[GFM Heading Links] Error in hover-link patch:", err);
            }
        }
        return originalTrigger(name, ...args);
    };

    return () => {
        workspace.trigger = originalTrigger;
    };
}

import { MarkdownView } from "obsidian";
import { resolveGfmTarget, type GfmHeadingLinksPlugin } from "./resolve-target";
import { revealTargetInView } from "./reveal-target";
import { debugLog } from "./debug";

/**
 * Applies monkey-patches to Obsidian's core Workspace router.
 *
 * This function intercepts two main native behaviors to support GFM heading links:
 * 1. `workspace.openLinkText`: Intercepts link clicks across the app. Resolves GFM slugs and injects
 *    a temporary virtual block ID to trick Obsidian into seamlessly scrolling to the target heading.
 * 2. `workspace.trigger("hover-link")`: Intercepts the Page Preview hover event. Mutates the event
 *    payload mid-air to point to a virtual block, allowing the native preview modal to render correctly.
 *
 * @param plugin - The main GfmHeadingLinksPlugin instance containing the IndexCache.
 * @returns A cleanup closure function that restores the original native methods.
 *          Must be called during the plugin's `onunload` lifecycle.
 */
export function applyWorkspacePatches(plugin: GfmHeadingLinksPlugin): () => void {
    /**
     * Backups Obsidian's Native function.
     * Returns a cleanup function to be called later on plugin unload.
     */
    const workspace = plugin.app.workspace;

    // STEP 1: Backup Obsidian's Native Functions
    // We save the original, unmodified functions so we don't lose them permanently.
    const originalTrigger = workspace.trigger;
    const originalOpenLinkText = workspace.openLinkText;

    // STEP 2: Apply the Patch (Monkey Patching)
    // We overwrite Obsidian's native functions with our own custom logic right now.

    /**
     * Patched `openLinkText` method.
     * Obsidian's UI (e.g. clicking a link in Reading mode or Cmd+Clicking in Editor) naturally
     * calls this method and passes these arguments. Because we monkey-patched it, Obsidian
     * unknowingly hands those parameters directly to us.
     *
     * @param linktext - The full link text being opened (e.g., "Note#my-gfm-slug").
     * @param sourcePath - The file path where the link was clicked (for relative resolution).
     * @param newLeaf - Optional. Whether to open the link in a new leaf (tab/pane).
     * @param openViewState - Optional. The view state to apply when opening.
     * @returns A promise that resolves when the link is fully opened.
     */
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

                    // STEP 1: Attempt to resolve the GFM slug via our custom cache
                    const targetResolution = await resolveGfmTarget(plugin, notePath, slug, sourcePath);

                    if (targetResolution.type === "success" && targetResolution.target && targetResolution.file) {
                        if (targetResolution.target.type === "heading") {
                            // STEP 2: Virtual Block Injection for native highlighting
                            // We get the Obsidian file metadata cache to temporarily inject a block reference
                            const cache = plugin.app.metadataCache.getFileCache(targetResolution.file);
                            if (cache) {
                                const virtualId = `gfm-click-${targetResolution.target.slug}`;

                                // `cache.blocks` is undefined if the file has no existing `^blocks`.
                                // We must initialize it before we can safely push our virtualId into it.
                                if (!cache.blocks) {
                                    cache.blocks = {};
                                }

                                // Inject a temporary block referencing the exact section position (start to end)
                                cache.blocks[virtualId] = {
                                    id: virtualId,
                                    position: targetResolution.target.position
                                };

                                // STEP 3: Delegate back to Obsidian with the virtual block
                                // Let native openLinkText navigate to our virtual block.
                                // If notePath is empty (same-file link), we keep it empty to avoid flicker/reloads.
                                const targetLinktext = notePath ? `${notePath}#^${virtualId}` : `#^${virtualId}`;
                                const res = await originalOpenLinkText.call(this, targetLinktext, sourcePath, newLeaf, openViewState);

                                // STEP 4: Cleanup the temporary block
                                // Remove the virtual block after enough time has passed for scrolling to finish.
                                setTimeout(() => {
                                    if (cache.blocks && cache.blocks[virtualId]) {
                                        delete cache.blocks[virtualId];
                                    }
                                }, 1500);

                                return res; // Successfully handled natively
                            }
                        }

                        // STEP 5: Fallback manual reveal (HTML Anchors or if cache fails)
                        // First, open the file itself WITHOUT the hash to bypass native failed resolution.
                        await originalOpenLinkText.call(this, targetResolution.file.path, sourcePath, newLeaf, openViewState);

                        // Then, manually find the view and scroll to the target line (TASK-0402).
                        const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
                        if (view && view.file?.path === targetResolution.file.path) {
                            revealTargetInView(view, targetResolution.target);
                        } else {
                            // If the user middle-clicked to open in a background tab, it won't be the "Active View".
                            // We must search all leaves to find the newly opened tab so we can scroll it.
                            const leaves = plugin.app.workspace.getLeavesOfType("markdown");
                            for (const leaf of leaves) {
                                if (leaf.view instanceof MarkdownView && leaf.view.file?.path === targetResolution.file.path) {
                                    revealTargetInView(leaf.view, targetResolution.target);
                                    break;
                                }
                            }
                        }
                        return; // Successfully handled
                    }
                }
            }
        } catch (err) {
            console.error("[GFM Heading Links] Error in openLinkText patch:", err);
        }

        // STEP 6: Passthrough to Native Handler
        // If it's not a string, no hash is present, or our resolution failed/was bypassed,
        // we fall back to the original, untouched Obsidian behavior.
        return originalOpenLinkText.call(this, linktext, sourcePath, newLeaf, openViewState);
    };

    /**
     * Patched `trigger` method to intercept workspace events.
     * Specifically intercepts the `hover-link` event used by the native Page Preview core plugin.
     * Resolves GFM slugs synchronously and mutates the event payload mid-air so that Obsidian's
     * native hover plugin looks for our injected virtual block instead of the raw, unresolvable slug.
     *
     * @param name - The name of the workspace event being triggered.
     * @param args - The arguments for the event (for `hover-link`, arg 0 is the payload object).
     */
    workspace.trigger = function (name: string, ...args: any[]) {
        if (name === "hover-link" && args.length > 0) {
            debugLog("patch:hover-link:intercepted", { argCount: args.length });
            try {
                const data = args[0];
                if (data && typeof data.linktext === "string") {
                    let linktext: string = data.linktext;
                    const hashIdx = linktext.indexOf("#");

                    /*
                    * >[!warning]
                    * >!FIX `console.log` poluting code. Should be better implemented. This applies for every `console.log()` call.
                    * >
                    * >**Must define specific task for removing it** first thing, while keeping the capabilities of enabling or not the outputs. Especially in the dev branch. Do not do this task without explicit user content with #askQuestions tool.
                    * >
                    * >There must be a way to do this, similar to python's decorators or something that allows to debug print on demand.
                    * >
                    * >Evaluate other possibilities for debugging as well.
                    * >
                    * >Beyond that, it would be interesting to have a log folder in this repo and branches of it. The tests done should be there as logs, so the tests shall be printed.
                    */
                    debugLog("patch:hover-link:parsed", { linktext, hashIdx });

                    if (hashIdx !== -1) {
                        const notePath = linktext.substring(0, hashIdx);
                        const slug = linktext.substring(hashIdx + 1);
                        debugLog("patch:hover-link:slug", { slug });

                        const isGfmSlug = slug.length > 0 &&
                            !/[A-Z]/.test(slug) &&
                            !/%[0-9A-Fa-f]{2}/.test(slug) &&
                            !slug.startsWith("^") &&
                            !slug.startsWith("[^");

                        debugLog("patch:hover-link:guard", { isGfmSlug });

                        if (isGfmSlug) {
                            let decodedSlug: string;
                            try {
                                decodedSlug = decodeURIComponent(slug);
                            } catch {
                                decodedSlug = slug;
                            }
                            debugLog("patch:hover-link:decoded", { decodedSlug, notePath });

                            // Find sourcePath
                            let sourcePath = "";
                            if (data.sourcePath) {
                                sourcePath = data.sourcePath;
                            } else if (data.hoverParent?.file?.path) {
                                sourcePath = data.hoverParent.file.path;
                            } else {
                                sourcePath = plugin.app.workspace.getActiveFile()?.path ?? "";
                            }
                            debugLog("patch:hover-link:sourcePath", { sourcePath });

                            // Resolve target file synchronously
                            let file = null;
                            if (notePath === "") {
                                const abstractFile = plugin.app.vault.getAbstractFileByPath(sourcePath);
                                if (abstractFile && 'extension' in abstractFile) file = abstractFile;
                            } else {
                                file = plugin.app.metadataCache.getFirstLinkpathDest(notePath, sourcePath);
                            }
                            debugLog("patch:hover-link:fileResolved", { path: file?.path });

                            if (file && (file as any).extension === "md") {
                                const cache = plugin.app.metadataCache.getFileCache(file as any);
                                debugLog("patch:hover-link:cache", { hasCache: !!cache, headingCount: cache?.headings?.length });
                                if (cache && cache.headings) {
                                    const { buildDocumentIndex } = require("./document-index");
                                    const index = buildDocumentIndex(cache);
                                    const target = index.get(decodedSlug);
                                    debugLog("patch:hover-link:target", { found: !!target, type: target?.type });

                                    if (target && target.type === "heading") {
                                        const virtualId = `gfm-${decodedSlug}`;

                                        // Initialize blocks object if it doesn't exist
                                        if (!cache.blocks) {
                                            cache.blocks = {};
                                        }

                                        // Inject a temporary block referencing the exact line numbers
                                        cache.blocks[virtualId] = {
                                            id: virtualId,
                                            position: target.position || {
                                                start: { line: target.line, col: 0, offset: 0 },
                                                end: { line: target.endLine, col: 0, offset: 0 }
                                            }
                                        };

                                        // Rewrite the link to point to this temporary virtual block
                                        data.linktext = `${notePath}#^${virtualId}`;
                                        debugLog("reveal:preview-virtual-block", { originalSlug: decodedSlug, virtualId });

                                        // Clean up the virtual block after the preview has loaded
                                        setTimeout(() => {
                                            if (cache.blocks && cache.blocks[virtualId]) {
                                                delete cache.blocks[virtualId];
                                            }
                                        }, 1500);
                                    }
                                }
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

    // STEP 3: Return the Cleanup Function (Closure)
    // `patchWorkspace` finishes executing here and RETURNS this brand new anonymous function.
    // It is OUR responsibility to catch this returned function in `main.ts` and call it during `onunload`.
    return () => {
        // When this returned function is finally called in `onunload`, it restores the backups.
        workspace.trigger = originalTrigger;
        workspace.openLinkText = originalOpenLinkText;
    };
}
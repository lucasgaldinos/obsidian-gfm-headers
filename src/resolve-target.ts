/**
 * GFM Target Resolution — The Decision Engine.
 *
 * This module contains the central resolution logic that answers the question: "Given a link text like `Note#my-heading`, where should we navigate?"
 *
 * ## The resolution pipeline
 *
 * `resolveGfmTarget()` is the single entry point called by `patch-workspace.ts` whenever a link click or hover event is intercepted. It performs a five-stage pipeline to determine what to do with a link:
 *
 * ```
 * Input: linktext = "Notes/ideas#my-heading", sourcePath = "daily/2024-01-01.md"
 *
 * Stage 1: GUARD — Is this even a GFM link?
 *   → Check for uppercase, URL encoding, block refs, empty slugs
 *   → If not GFM: return { type: "passthrough" }
 *
 * Stage 2: DECODE — Handle URL encoding
 *   → decodeURIComponent("my%2dheading") → "my-heading"
 *   → (GFM slugs shouldn't normally be encoded, but handle it gracefully)
 *
 * Stage 3: RESOLVE FILE — Find the target note
 *   → If notePath is empty: same-file link, resolve via sourcePath
 *   → If notePath is provided: cross-file link, resolve via getFirstLinkpathDest
 *   → If file not found: return { type: "file-not-found" }
 *
 * Stage 4: LOOKUP — Search the document index
 *   → Get the file's DocumentIndex from IndexCache (lazy-loaded)
 *   → Look up the decoded slug in the Map (O(1))
 *   → If found: return { type: "success", target, file }
 *
 * Stage 5: FALLBACK — Let Obsidian handle it
 *   → Slug not in index: maybe it's a native Obsidian link
 *   → return { type: "passthrough", file }
 * ```
 *
 * ## Why this module exists separately
 *
 * Resolution logic is shared between two consumers:
 * 1. `patch-workspace.ts` — for link clicks (async, needs full resolution)
 * 2. `patch-workspace.ts` — for hover previews (sync where possible)
 *
 * By centralizing the resolution in one function, both consumers get identical behavior without code duplication.
 */

import { Plugin, TFile } from "obsidian";
import type { ResolutionResult } from "./link-target";
import type { IndexCache } from "./index-cache";

/**
 * Extended Plugin interface that guarantees the presence of our IndexCache.
 *
 * Obsidian's base `Plugin` class doesn't know about our custom cache. This interface extends it to add the `indexCache` property, allowing other modules to accept a `GfmHeadingLinksPlugin` and safely access `plugin.indexCache` without type assertions.
 *
 * This is the canonical "plugin reference" type used throughout the codebase. Any function that needs access to both Obsidian's API and our custom cache should accept this type rather than the base `Plugin` type.
 */
export interface GfmHeadingLinksPlugin extends Plugin {
    indexCache: IndexCache;
}

/**
 * Resolves a GFM-formatted link fragment to a concrete navigation target.
 *
 * This is THE function that makes GFM links work. It's called from `patch-workspace.ts` whenever a user clicks or hovers a link containing `#`.
 *
 * ## The GFM slug detection heuristic
 *
 * We need to distinguish GFM slugs from Obsidian's native heading format WITHOUT false positives. The heuristic:
 *
 * **A slug is GFM if it:**
 * - Is non-empty
 * - Contains NO uppercase letters (GFM slugs are always lowercase)
 * - Contains NO URL-encoded characters (`%XX` patterns)
 * - Does NOT start with `^` (that's a block reference)
 * - Does NOT start with `[^` (that's a footnote)
 *
 * **Examples:**
 * | Link text | GFM? | Reason |
 * |-----------|------|--------|
 * | `#my-heading` | ✅ Yes | Lowercase, hyphenated |
 * | `#My Heading` | ❌ No | Uppercase + space = Obsidian format |
 * | `#my%20heading` | ❌ No | URL-encoded = probably Obsidian |
 * | `#^block123` | ❌ No | Block reference |
 * | `#[^footnote]` | ❌ No | Footnote reference |
 *
 * This heuristic is intentionally conservative: when in doubt, we pass through to Obsidian's native handler. False negatives (thinking a GFM link is not GFM) are acceptable — the link still works via Obsidian's fallback. False positives (thinking an Obsidian link is GFM) would BREAK native links, which is unacceptable.
 *
 * ## Same-file vs cross-file links
 *
 * - **Same-file**: `notePath` is empty string `""`. The target is in the same file as the link. We resolve the file from `sourcePath`.
 * - **Cross-file**: `notePath` is a path like `"Notes/ideas"` or `"ideas"`. We use Obsidian's `getFirstLinkpathDest()` which handles wikilinks, relative paths, and shortest-path matching.
 *
 * ## URL decoding
 *
 * Some link sources (particularly from other plugins or external tools) may URL-encode the slug. GFM slugs should never NEED encoding (they only contain lowercase letters, numbers, hyphens, and underscores), but we handle it defensively with a try/catch around `decodeURIComponent`. If the slug is malformed (e.g., `%ZZ` which is invalid hex), we fall back to the raw value.
 *
 * @param plugin - The plugin instance, providing access to Obsidian's API
 *                 and our IndexCache.
 * @param notePath - The path portion of the link (everything before `#`).
 *                   Empty string for same-file links.
 * @param rawSlug - The raw slug portion of the link (everything after `#`).
 *                  Should already have `#` stripped by the caller.
 * @param sourcePath - The vault-relative path of the file containing the link.
 *                     Used for resolving relative note paths and same-file links.
 * @returns A `ResolutionResult` indicating success, passthrough, or file-not-found.
 *
 * @example
 * ```ts
 * // Same-file GFM link
 * const result = await resolveGfmTarget(plugin, "", "my-heading", "notes/ideas.md");
 * // result = { type: "success", target: HeadingAnchorTarget, file: TFile("notes/ideas.md") }
 *
 * // Cross-file GFM link
 * const result = await resolveGfmTarget(plugin, "OtherNote", "introduction", "notes/ideas.md");
 * // result = { type: "success", target: HeadingAnchorTarget, file: TFile("OtherNote.md") }
 *
 * // Obsidian-format link (passthrough)
 * const result = await resolveGfmTarget(plugin, "Note", "My Heading", "notes/ideas.md");
 * // result = { type: "passthrough" }
 *
 * // Broken link
 * const result = await resolveGfmTarget(plugin, "NonExistent", "heading", "notes/ideas.md");
 * // result = { type: "file-not-found" }
 * ```
 */
export async function resolveGfmTarget(
    plugin: GfmHeadingLinksPlugin,
    notePath: string,
    rawSlug: string,
    sourcePath: string
): Promise<ResolutionResult> {
    // ─── STAGE 1: Guard — Detect non-GFM links ───
    //
    // We apply a series of tests to determine if this slug looks like a GFM slug. If ANY test indicates it's NOT a GFM slug, we bail out immediately with "passthrough" — let Obsidian's native handler deal with it.
    //
    // The tests are ordered by likelihood for efficiency:
    // - Empty slug check first (fastest, catches missing anchors)
    // - Uppercase check (most Obsidian headings have uppercase)
    // - URL-encoding check (rare but unambiguous)
    // - Block reference check (^ is never in GFM slugs)
    // - Footnote check ([^ is never in GFM slugs)
    if (
        rawSlug.length === 0 ||                          // No slug at all (e.g., "Note#")
        /[A-Z]/.test(rawSlug) ||                         // Contains uppercase (Obsidian format)
        /%[0-9A-Fa-f]{2}/.test(rawSlug) ||               // Contains URL encoding (%20, %2F, etc.)
        rawSlug.startsWith("^") ||                        // Block reference (^block-id)
        rawSlug.startsWith("[^")                          // Footnote reference ([^note])
    ) {
        return { type: "passthrough" };
    }

    // ─── STAGE 2: URL Decode ───
    //
    // GFM slugs should not normally be URL-encoded, but we decode defensively. The try/catch handles malformed encoding like "%ZZ" (invalid hex). If decoding fails, we use the raw slug as-is.
    let decodedSlug: string;
    try {
        decodedSlug = decodeURIComponent(rawSlug);
    } catch {
        decodedSlug = rawSlug;
    }

    // ─── STAGE 3: Resolve the target file ───
    //
    // Two cases:
    // 1. Same-file link (notePath is empty): The target is in the same file as the link. We look up the sourcePath in the vault.
    // 2. Cross-file link (notePath is provided): We use Obsidian's built-in link resolution which handles wikilinks, relative paths, and shortest-path matching.
    let file: TFile | null = null;
    if (notePath === "") {
        // Same-file link: resolve the source file. We use getAbstractFileByPath which returns a TAbstractFile. We then check if it's actually a TFile (markdown file) rather than a folder or other abstract file type.
        const abstractFile = plugin.app.vault.getAbstractFileByPath(sourcePath);
        if (abstractFile instanceof TFile) {
            file = abstractFile;
        }
    } else {
        // Cross-file link: use Obsidian's link resolution engine. `getFirstLinkpathDest` handles:
        // - Wikilinks: [[Note]] → finds Note.md
        // - Relative paths: [[../OtherNote]] → resolves relative to sourcePath
        // - Shortest path: [[ideas]] → finds the best match among all ideas.md files
        file = plugin.app.metadataCache.getFirstLinkpathDest(notePath, sourcePath);
    }

    // If the file doesn't exist in the vault, we can't go anywhere. Return "file-not-found" so the caller can show Obsidian's native "file not found" behavior (e.g., creating the note on click).
    if (!file) {
        return { type: "file-not-found" };
    }

    // ─── STAGE 4: Look up the slug in the document index ───
    //
    // This is where the actual GFM resolution happens. plugin.indexCache.get() is lazy: if this file hasn't been indexed yet, it will compute the index now (reading file content + scanning headings). Subsequent calls for the same file return the cached index instantly.
    const index = await plugin.indexCache.get(file);
    const target = index.get(decodedSlug);

    if (target) {
        // Found it! Return success with the target and file. The caller (patchWorkspace) will use target.position to inject a virtual block for native scrolling, and target.line for fallback reveal.
        return { type: "success", target, file };
    }

    // ─── STAGE 5: Fallback — Let Obsidian handle it ───
    //
    // The slug wasn't found in our GFM index. This could mean:
    // - It's a native Obsidian heading link that happened to pass our GFM guard (e.g., all-lowercase Obsidian heading)
    // - The heading/HTML anchor genuinely doesn't exist (broken link)
    //
    // In either case, we return "passthrough" with the file set. Obsidian will at least open the correct file, and its native handler will deal with the heading resolution (or show "heading not found" if it's broken).
    return { type: "passthrough", file };
}

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
import type { ResolutionResult } from "./types";
import type { IndexCache } from "./index-cache";
import { isGfmSlug } from "./gfm-slugify";
import { buildDocumentIndex } from "./document-index";

/**
 * Extended Plugin interface that guarantees the presence of our IndexCache
 * and user-customizable settings.
 *
 * Obsidian's base `Plugin` class doesn't know about our custom cache or
 * settings. This interface extends it to add `indexCache` and `settings`,
 * allowing other modules to accept a `GfmHeadingLinksPlugin` and safely
 * access both without type assertions.
 *
 * This is the canonical "plugin reference" type used throughout the codebase.
 */
export interface GfmHeadingLinksPlugin extends Plugin {
    indexCache: IndexCache;
    settings: { prefix: string; suffix: string; enableWikilinkAlias: boolean };
}

// ─── Shared resolution helpers (TASK-1012) ───
// Extracted from resolveGfmTarget() and resolveGfmTargetSync() to eliminate
// ~180 lines of duplicated guard, decode, and file-resolution logic.

/**
 * Guards and decodes a raw link slug against GFM conventions.
 * Returns the decoded slug if it passes the GFM guard, or null if it
 * should be handled by Obsidian's native resolver (passthrough).
 */
function decodeGfmSlug(rawSlug: string): string | null {
    if (!isGfmSlug(rawSlug)) return null;
    try {
        return decodeURIComponent(rawSlug);
    } catch {
        return rawSlug;
    }
}

/**
 * Resolves a note path to a TFile in the vault.
 * Handles both same-file links (notePath === "") and cross-file links.
 */
function resolveTargetFile(
    plugin: GfmHeadingLinksPlugin,
    notePath: string,
    sourcePath: string
): TFile | null {
    if (notePath === "") {
        const abstractFile = plugin.app.vault.getAbstractFileByPath(sourcePath);
        return abstractFile instanceof TFile ? abstractFile : null;
    }
    return plugin.app.metadataCache.getFirstLinkpathDest(notePath, sourcePath);
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
    // Stage 1+2: Guard and decode (shared helper)
    const decodedSlug = decodeGfmSlug(rawSlug);
    if (!decodedSlug) return { type: "passthrough" };

    // Stage 3: Resolve the target file (shared helper)
    const file = resolveTargetFile(plugin, notePath, sourcePath);
    if (!file) return { type: "file-not-found" };

    // Stage 4: Look up the slug in the document index (async — with HTML anchors)
    const index = await plugin.indexCache.get(file);
    const target = index.get(decodedSlug);

    if (target) return { type: "success", target, file };

    // Stage 5: Fallback
    return { type: "passthrough", file };
}

/**
 * Synchronous variant of `resolveGfmTarget` for hover-link interception.
 *
 * The hover-link event (`workspace.trigger('hover-link')`) must mutate the
 * event payload synchronously before Obsidian processes it — async disk I/O
 * (`vault.read()`) is not possible in that code path. This function provides
 * the same GFM guard + file resolution + index lookup as the async variant,
 * but without HTML anchor scanning (which requires reading file contents).
 *
 * ## Differences from `resolveGfmTarget`
 *
 * - **No HTML anchors**: Only heading-based targets are resolved. HTML anchors
 *   require `vault.read()` which is async. The current hover handler already
 *   skips HTML anchors, so this is parity, not regression.
 * - **No IndexCache**: Calls `buildDocumentIndex()` directly from the metadata
 *   cache. This is acceptable for hover events because:
 *   1. The metadata cache is already in memory (no I/O).
 *   2. Hover events are transient — caching benefit is minimal.
 *   3. Keeping this sync avoids the complexity of a sync cache layer.
 * - **Same return type**: Returns `ResolutionResult` with the same discriminated
 *   union, so callers handle success/passthrough/file-not-found identically.
 *
 * @param plugin - The plugin instance, providing access to Obsidian's API.
 * @param notePath - The path portion of the link (everything before `#`).
 * @param rawSlug - The raw slug portion of the link (everything after `#`).
 * @param sourcePath - The vault-relative path of the file containing the link.
 * @returns A `ResolutionResult` — same shape as the async variant.
 *
 * @example
 * ```ts
 * const result = resolveGfmTargetSync(plugin, "", "my-heading", "notes/ideas.md");
 * if (result.type === "success" && result.target?.type === "heading") {
 *     injectVirtualBlock(cache, result.target.slug, result.target.position, "gfm-");
 * }
 * ```
 */
export function resolveGfmTargetSync(
    plugin: GfmHeadingLinksPlugin,
    notePath: string,
    rawSlug: string,
    sourcePath: string
): ResolutionResult {
    // Stage 1+2: Guard and decode
    const decodedSlug = decodeGfmSlug(rawSlug);
    if (!decodedSlug) return { type: "passthrough" };

    // Stage 3: Resolve the target file
    const file = resolveTargetFile(plugin, notePath, sourcePath);
    if (!file) return { type: "file-not-found" };

    // Stage 4: Build index from metadata cache (sync, no disk I/O)
    const cache = plugin.app.metadataCache.getFileCache(file);
    if (!cache || !cache.headings) return { type: "passthrough", file };

    const index = buildDocumentIndex(cache);
    const target = index.get(decodedSlug);

    if (target) return { type: "success", target, file };

    // Stage 5: Fallback
    return { type: "passthrough", file };
}

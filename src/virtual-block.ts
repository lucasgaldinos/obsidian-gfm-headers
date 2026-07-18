/**
 * Virtual Block Injection — Shared Utility for GFM Heading Navigation.
 *
 * This module provides the single shared implementation of the virtual block
 * injection pattern used by both click navigation and hover preview. Previously
 * this pattern was duplicated in `patch-workspace.ts` with the only difference
 * being the virtual block ID prefix (`gfm-click-` vs `gfm-`).
 *
 * ## How it works
 *
 * 1. A temporary block entry is injected into Obsidian's `cache.blocks` map
 *    with a synthetic block ID and the target heading's section position.
 * 2. The caller rewrites the link text to point to `#^virtualId` instead of
 *    the original GFM slug.
 * 3. Obsidian's native navigation/preview renderer resolves the block
 *    reference and scrolls/highlights the target section.
 * 4. After `VIRTUAL_BLOCK_CLEANUP_MS` milliseconds, the temporary block
 *    is removed from `cache.blocks` to avoid polluting Obsidian's cache.
 *
 * Extracted per TASK-1006. DRY, single source of truth for the cleanup timeout.
 */

import type { CachedMetadata } from "obsidian";

/**
 * Time in milliseconds before injected virtual blocks are cleaned up from
 * Obsidian's metadata cache. Long enough for navigation and preview rendering
 * to complete, short enough to avoid cache pollution.
 */
export const VIRTUAL_BLOCK_CLEANUP_MS = 1500;

/**
 * Injects a temporary virtual block into Obsidian's metadata cache and returns
 * a cleanup function.
 *
 * The returned cleanup function can be called to immediately remove the block
 * (e.g., on plugin unload) — otherwise the block auto-cleans after
 * `VIRTUAL_BLOCK_CLEANUP_MS` milliseconds.
 *
 * @param cache - The file's `CachedMetadata` from `metadataCache.getFileCache()`.
 *                The `blocks` property will be initialized if undefined.
 * @param slug - The GFM slug to embed in the virtual block ID (after the prefix).
 * @param position - The section position object (start/end line+col+offset)
 *                   from the document index. Matches Obsidian's internal Pos format.
 * @param prefix - Distinguishing prefix for the virtual block ID
 *                 (e.g., `"gfm-click-"` for click navigation,
 *                 `"gfm-"` for hover preview).
 * @returns A cleanup function that, when called, clears the timeout and removes
 *          the virtual block from `cache.blocks`. Safe to call multiple times.
 *
 * @example
 * ```ts
 * const cache = plugin.app.metadataCache.getFileCache(file);
 * const cleanup = injectVirtualBlock(cache, "my-heading", target.position, "gfm-click-");
 * // ... navigate using `#^gfm-click-my-heading` ...
 * // After navigation completes or on unload:
 * cleanup();
 * ```
 */
export function injectVirtualBlock(
    cache: CachedMetadata,
    slug: string,
    position: any,
    prefix: string
): () => void {
    const virtualId = `${prefix}${slug}`;

    // Initialize blocks map if the file has no existing block references
    if (!cache.blocks) {
        cache.blocks = {};
    }

    // Inject the temporary block entry
    cache.blocks[virtualId] = {
        id: virtualId,
        position
    };

    // Schedule automatic cleanup
    const timer = setTimeout(() => {
        if (cache.blocks && cache.blocks[virtualId]) {
            delete cache.blocks[virtualId];
        }
    }, VIRTUAL_BLOCK_CLEANUP_MS);

    // Return manual cleanup function (also clears the timeout)
    return () => {
        clearTimeout(timer);
        if (cache.blocks && cache.blocks[virtualId]) {
            delete cache.blocks[virtualId];
        }
    };
}

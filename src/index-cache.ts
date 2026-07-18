/**
 * Index Cache — Lazy-Loaded, Event-Invalidated Document Index Store.
 *
 * This module is the **memory** of the plugin. It maintains a Map of file paths to their computed `DocumentIndex` objects, ensuring we never recompute the same file's index more than necessary.
 *
 * ## The caching strategy
 *
 * We use a **lazy-loading, promise-based cache** with three key properties:
 *
 * 1. **Lazy**: An index is not computed until the first time something asks for it (via `get()`). This avoids wasting CPU on files the user never links to.
 *
 * 2. **Promise-valued**: The cache stores `Promise<DocumentIndex>`, not `DocumentIndex` directly. This is crucial because `computeIndex()` is async (it reads file contents from disk). By storing the promise itself, multiple concurrent callers requesting the same uncached file will all await the SAME promise — we compute once, they all get the result.[^obs-1a]
 *
 *     [^obs-1a]: How does this work? How the `Promise` is the same as a `DocumentIndex`? How does `async` behave when it's expecting a promise? This question has more to do with typescript programming itself and not with this repository.
 *
 * 3. **Event-invalidated**: When a file changes (edit, rename, delete), the  cache entry is purged or updated. The next `get()` call will recompute  the index from the fresh file content.
 *
 * ## Why not use Obsidian's built-in metadata cache directly?
 *
 * Obsidian's `metadataCache` already stores heading information. However:
 *
 * - It stores raw heading data, not our GFM-slug-keyed index format.
 * - It doesn't include HTML anchors (we need `scanHtmlAnchors` for those).
 * - Building the index requires iterating all headings + scanning file content, which is non-trivial work we don't want to repeat on every link click.
 *
 * Our cache sits ON TOP of Obsidian's metadata cache, adding the GFM-specific transformation layer and the HTML anchor scanning on top.
 *
 * ## Memory considerations
 *
 * The cache stores one `DocumentIndex` (a Map) per visited file. For a vault with 10,000 markdown files averaging 50 headings each, that's ~500,000 map entries. At roughly 200 bytes per entry (string key + object value), that's ~100MB of memory. In practice:
 *
 * - Most vaults have far fewer files.
 * - We only cache files that have actually been linked to (lazy loading).
 * - JavaScript's garbage collector will free entries for files that are deleted.
 *
 * If memory becomes an issue in the future, we could add an LRU eviction policy or a maximum cache size, but for now the simple Map is sufficient.
 */

import { Plugin, TFile } from "obsidian";
import type { DocumentIndex } from "./types";
import { buildDocumentIndex, scanHtmlAnchors } from "./document-index";

/**
 * Central cache for document indices across the vault.
 *
 * This class is instantiated once in `main.ts` during plugin `onload` and lives for the entire plugin lifecycle. It is the single source of truth for "what GFM slugs exist in what files right now."
 *
 * ## Lifecycle
 *
 * 1. **Created** in `GfmHeadingLinksPluginImpl.onload()` as `this.indexCache`.
 * 2. **Populated lazily** as users click/hover links — only files that are actually referenced get their indices computed.
 * 3. **Invalidated** by event listeners in `main.ts`:
 *    - `metadataCache.on("changed")` → `invalidate(file)`
 *    - `vault.on("rename")` → `invalidateRename(oldPath, newPath)`
 *    - `vault.on("delete")` → `invalidate(file)`
 * 4. **Destroyed** when the plugin is unloaded (JavaScript GC handles this since the Map is only referenced by the plugin instance).
 *
 * ## Thread safety (JavaScript single-threaded context)
 *
 * Because Obsidian plugins run in a single-threaded JavaScript environment (the renderer process), we don't need mutexes or locks. The promise-based deduplication (storing the promise itself in the cache) handles concurrent access naturally: all await-ers of the same promise will receive the same resolved value.
 */
export class IndexCache {
    /**
     * The internal cache storage.
     *
     * - **Key**: The full vault-relative file path (e.g., `"notes/ideas.md"`).
     * - **Value**: A `Promise<DocumentIndex>` — storing the promise rather than the resolved value ensures that if two callers request the same file simultaneously, they both await the same computation rather than triggering duplicate work.
     *
     * We use a plain `Map` rather than `WeakMap` because:
     * - We need to iterate/invalidate by path string, not by object reference.
     * - File objects from Obsidian may be recreated for the same path.
     * - A `WeakMap` keyed by `TFile` would lose entries when the TFile object is garbage collected, which could happen between cache population and cache use.
     */
    private cache = new Map<string, Promise<DocumentIndex>>();

    /**
     * @param plugin - Reference to the Obsidian Plugin instance. We store this so we can access `plugin.app.vault.read()` and `plugin.app.metadataCache.getFileCache()` during index computation.
     */
    constructor(private plugin: Plugin) {}

    /**
     * Retrieves (or computes and caches) the DocumentIndex for a given file.
     *
     * This is the primary public API of the cache. Every other module that needs to resolve GFM slugs calls this method.
     *
     * ## How it works
     *
     * 1. Check if the file path already exists in the cache Map.
     * 2. If YES (cache hit): Return the stored Promise immediately. The caller awaits it and gets the index. Zero additional work.
     * 3. If NO (cache miss): Call `computeIndex(file)` which:
     *    a. Reads the file content from disk (async I/O).
     *    b. Scans for HTML anchors.
     *    c. Gets the heading cache from Obsidian's metadataCache.
     *    d. Builds the combined DocumentIndex.
     *    e. Stores the Promise in the cache Map BEFORE it resolves, so any concurrent callers will find the promise and await it too.
     * 4. Return the Promise (either cached or newly created).
     *
     * ## Promise deduplication detail
     *
     * This is subtle but important.
     * If we stored the RESOLVED value:
     * ```ts
     * // BAD — concurrent callers would both compute
     * if (!cache.has(path)) {
     *   const index = await computeIndex(file); // caller 2 doesn't see this yet
     *   cache.set(path, index);
     * }
     * return cache.get(path);
     * ```
     *
     * By storing the PROMISE:
     * ```ts
     * // GOOD — concurrent callers share the same promise
     * if (!cache.has(path)) {
     *   cache.set(path, computeIndex(file)); // stored BEFORE awaiting
     * }
     * return cache.get(path); // caller 2 gets the same promise
     * ```
     *
     * @param file - The TFile to get the index for.
     * @returns A Promise that resolves to the complete DocumentIndex for this file, including both heading targets and HTML anchor targets.
     */
    public async get(file: TFile): Promise<DocumentIndex> {
        const path = file.path;

        // Cache miss: compute the index and store the promise immediately.
        // We store BEFORE awaiting to enable promise deduplication (explained above).
        if (!this.cache.has(path)) {
            this.cache.set(path, this.computeIndex(file));
        }

        // Return the cached promise (either pre-existing or just-created).
        // The '!' assertion is safe because we just set it if it was missing.
        return this.cache.get(path)!;
    }

    /**
     * Builds a fresh DocumentIndex for a file by combining heading metadata with HTML anchor scanning.
     *
     * This is the only place where indices are created. It orchestrates two data sources:
     *
     * 1. **Obsidian's heading cache** (via `buildDocumentIndex`): Fast, already in memory, maintained by Obsidian's parser. Contains all markdown headings with positions and levels.
     *
     * 2. **Raw file content** (via `scanHtmlAnchors`): Requires disk I/O (`vault.read()`), but necessary because Obsidian does not track HTML anchors in its metadata cache. Contains `<a id="...">` and `<a name="...">` anchors.
     *
     * These two sources are merged into a single DocumentIndex Map. Heading targets take priority over HTML anchors: if both a heading and an HTML anchor produce the same slug, the heading wins (because headings are the primary navigation mechanism).
     *
     * ## Why read the file content?
     *
     * We can't avoid this. Obsidian's `CachedMetadata` tracks:
     * - Headings (via `cache.headings`)
     * - Sections (via `cache.sections`)
     * - Tags, links, embeds, blocks, etc.
     *
     * It does NOT track arbitrary HTML elements. Since GFM supports `<a id="...">` as valid anchor targets, and many users import documentation that uses them, we must scan the raw text.
     *
     * If Obsidian ever adds HTML anchor tracking to its metadata cache, we could remove the file read and make this fully synchronous.
     *
     * @param file - The file to compute the index for.
     * @returns A Promise resolving to the complete DocumentIndex.
     */
    private async computeIndex(file: TFile): Promise<DocumentIndex> {
        // STEP 1: Read file content for HTML anchor scanning.
        // This is an async disk I/O operation — the only reason this method
        // is async. Everything else (heading cache access, index building)
        // is synchronous.
        const content = await this.plugin.app.vault.read(file);
        const htmlAnchors = scanHtmlAnchors(content);

        // STEP 2: Get cached heading metadata from Obsidian.
        // This is synchronous — Obsidian maintains this cache in memory.
        // It may be null if the file hasn't been parsed yet (unlikely, since
        // Obsidian parses all files on startup).
        const cache = this.plugin.app.metadataCache.getFileCache(file);

        // STEP 3: Build the heading-based portion of the index.
        // If cache is null, we pass an empty headings array so the index
        // builder can still produce a valid (empty) Map.
        const index = buildDocumentIndex(cache || { headings: [] });

        // STEP 4: Merge HTML anchors into the index.
        // We only add an HTML anchor if its slug doesn't already exist in
        // the index. This means headings ALWAYS take priority over HTML anchors
        // when there's a slug collision, which is the expected behavior:
        // headings are the primary navigation mechanism, HTML anchors are fallbacks.
        for (const anchor of htmlAnchors) {
            if (!index.has(anchor.slug)) {
                index.set(anchor.slug, anchor);
            }
        }

        return index;
    }

    /**
     * Removes a file's cached index, forcing the next `get()` call to recompute it from scratch.
     *
     * Called when a file's content changes (edit) or the file is deleted.  After invalidation, the next link click or hover that targets this file will trigger a fresh `computeIndex()` call with the updated content.
     *
     * ## Why not update in-place?
     *
     * We could theoretically patch the existing index (add/remove/update individual entries), but that would require knowing exactly what changed. Obsidian's `metadataCache.on("changed")` event doesn't provide a diff — it just says "this file changed." Recomputing from scratch is simpler, less error-prone, and fast enough for typical markdown files (< 100ms).
     *
     * @param file - The file whose cache entry should be purged.
     */
    public invalidate(file: TFile): void {
        // Map.delete() is a no-op if the key doesn't exist, so we don't need
        // to check has() first. The entry is simply removed.
        this.cache.delete(file.path);
    }

    /**
     * Updates the cache key when a file is renamed or moved within the vault.
     *
     * Obsidian fires the `vault.on("rename")` event with both the old and new paths. We move the cached promise from the old key to the new key, preserving the already-computed index (which is still valid since the file content hasn't changed, only its location).
     *
     * ## Why preserve the cache on rename?
     *
     * File renames don't change content — the headings and HTML anchors are identical. Recomputing the index would be wasteful. The only thing that changes is the path, so we just update the Map key.
     *
     * ## Edge case: rename to an already-cached path
     *
     * If the new path already exists in the cache (unlikely — would mean two files had the same path, which Obsidian prevents), the old new-path entry is overwritten. The old old-path entry is still deleted. This is correct behavior: the renamed file replaces whatever was at the destination.
     *
     * @param oldPath - The file's previous vault-relative path.
     * @param newPath - The file's new vault-relative path.
     */
    public invalidateRename(oldPath: string, newPath: string): void {
        // Retrieve the cached promise from the old path key.
        const cached = this.cache.get(oldPath);
        if (cached) {
            // Remove the old key...
            this.cache.delete(oldPath);
            // ...and re-insert under the new key.
            // The promise itself is unchanged — it still resolves to the same
            // DocumentIndex, which is still valid since content hasn't changed.
            this.cache.set(newPath, cached);
        }
        // If there's no cached entry for the old path, this is a no-op.
        // The file simply hadn't been indexed yet.
    }
}

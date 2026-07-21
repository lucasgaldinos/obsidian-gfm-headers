/**
 * Editor Suggest Monkey-Patch — GFM Slug Injection for Autocomplete.
 *
 * This module intercepts Obsidian's native link autocomplete system and rewrites heading suggestions to use GFM slugs instead of Obsidian's proprietary heading format.
 *
 * ## The problem this solves
 *
 * When a user types `[[#` in the editor, Obsidian shows a dropdown of all headings in the vault/file. When the user selects a heading like "My Heading", Obsidian inserts `[[#My Heading]]` — using raw heading text with spaces and original case preserved.
 *
 * But Obsidian's native link resolver expects this exact format. If the user later (or another tool) generates GFM-style links like `[[#my-heading]]`, Obsidian won't resolve them — it's looking for "my-heading" as a raw heading text, not as a slug.
 *
 * This plugin's goal is to make GFM links work. Part of that goal is making it EASY for users to CREATE GFM links. By intercepting the autocomplete system, we ensure that when a user picks a heading from the dropdown, the inserted text uses the GFM slug format, not Obsidian's format.
 *
 * ## The monkey-patching approach
 *
 * Obsidian exposes its editor suggestors via `workspace.editorSuggest.suggests`, an array of suggestor instances. Each suggestor has a `selectSuggestion` method that is called when the user picks an item from the dropdown.
 *
 * We iterate over all suggestors, find the ones that handle link suggestions (they all have `selectSuggestion`), and wrap their method with our own logic that mutates the suggestion value BEFORE passing it to the original method.
 *
 * ## Why deferred initialization?
 *
 * In `main.ts`, the editor suggest patch is wrapped in a `setTimeout(..., 1000)`.
 * This is because Obsidian's suggestors may not be fully initialized when our plugin's `onload` runs. By waiting 1 second, we give Obsidian time to finish setting up its internal suggestors before we try to patch them.
 *
 * A more robust approach would be to use a MutationObserver or event listener to detect when suggestors are ready, but the setTimeout is simpler and works reliably in practice.
 *
 * ## The occurrence matching problem
 *
 * The trickiest part of this module is resolving which specific heading occurrence the user selected when there are duplicate headings.
 *
 * Obsidian's autocomplete shows ALL headings, including duplicates (e.g., three headings all named "Introduction" at different positions). The dropdown displays them as separate items, but the `value` object only contains `{ heading: "Introduction", level: 1 }` — no line number, no way to distinguish them[^obs-1b].
 *
 * [^obs-1b]: >[!warning] This behavior should not be reserved for this extension only.
 *      >
 *      >This behavior should also have a toggle, so even withou the editor suggestion, there are resoved different paths.
 *
 * Our `resolveGfmSlug()` function solves this by:
 * 1. Finding the selected item's index in the dropdown array.
 * 2. Counting how many identical items appear BEFORE it.
 * 3. Using that count as the "occurrence index" when searching the file's heading cache.
 * 4. Matching the Nth occurrence in the cache to the Nth occurrence in the dropdown.
 *
 * This is fragile (depends on dropdown order matching cache order), but it's the best we can do without Obsidian exposing line numbers in its suggestion values.
 */

import { gfmSlugify } from "./gfm-slugify";
import { debugLog } from "./debug";
import type { GfmHeadingLinksPlugin } from "./resolve-target";

/**
 * Resolves a heading suggestion value to its exact GFM slug by matching the dropdown position to the Nth occurrence of that heading in the file.
 *
 * ## The duplicate heading problem
 *
 * Consider a file with three "Introduction" headings at lines 10, 50, and 100. Obsidian's autocomplete shows three identical-looking entries. When the user picks the second one (line 50), we need to generate `introduction-1` (the GFM collision suffix), not just `introduction`.
 *
 * But the suggestion `value` object has no line number — just `heading` text and `level`. We need to figure out WHICH "Introduction" was picked.
 *
 * ## The solution (fragile but functional)
 *
 * We access the suggestor's internal `chooser` object (which manages the dropdown UI) and find the index of the selected item in its `values` array. Then we count how many identical items (same heading text + level) appear before it. This count becomes the "occurrence index."
 *
 * Then we iterate the file's heading cache (which IS ordered by line number), find matching headings, and return the slug for the Nth match where N equals the occurrence index.
 *
 * ## Why this is fragile
 *
 * - We access private/internal properties (`chooser.values`) that Obsidian could change in any update.
 * - The dropdown order might not always match cache order (though in practice it does).
 * - The `suggestionsArray.findIndex()` call relies on object identity or deep equality, which may not work if Obsidian creates new wrapper objects.
 *
 * The fallback (if occurrence matching fails) is `gfmSlugify(rawHeading)`, which produces the base slug without collision suffix. This is usually correct for non-duplicate headings.[^obs-2b]
 *
 * [^obs-2b]: How can we mitigate those?
 *
 * @param value - The suggestion value object from Obsidian's autocomplete.
 *                Expected shape: `{ heading: string, level: number, file: TFile }`.
 * @param app - The Obsidian App instance, used to access metadataCache.
 * @param suggestInstance - The suggestor instance (optional). Its `chooser`
 *                          property is used to find the selected item's position
 *                          in the dropdown for duplicate resolution.
 * @returns The complete GFM link fragment (e.g., `"#my-heading"` or
 *          `"#my-heading-1"`) or `null` if resolution fails.
 */
function resolveGfmSlug(value: any, app: any, suggestInstance?: any): string | null {
    // GUARD: Validate that the value has the expected shape.
    // If any required property is missing, we can't resolve — return null
    // and let the caller fall back to simple gfmSlugify().
    if (!value || typeof value.heading !== 'string' || typeof value.level !== 'number' || !value.file) {
        return null;
    }

    // Get the file's heading cache from Obsidian's metadata system.
    // This is ordered by line number, which is crucial for occurrence matching.
    const cache = app.metadataCache.getFileCache(value.file);
    if (!cache || !cache.headings) {
        return null;
    }

    // ─── STEP 1: Determine which occurrence in the dropdown this value is ───
    let occurrenceIndex = 0;
    try {
        if (suggestInstance) {
            // The suggestor's internal "chooser" manages the dropdown UI.
            // We need to access its values array to find our position.
            // Different Obsidian versions may use different property names,
            // so we try several common ones.
            const chooser = suggestInstance.chooser || suggestInstance.suggestions;
            const suggestionsArray = chooser?.values || chooser?.items || chooser?.suggestions;

            if (Array.isArray(suggestionsArray)) {
                // Find the index of the currently selected item in the dropdown array.
                // The selected item may be wrapped (e.g., `{ item: value }`) or unwrapped,
                // so we check both `s === value` and `s.item === value`.
                const selectedIndex = suggestionsArray.findIndex(
                    (s: any) => s === value || s.item === value
                );

                if (selectedIndex !== -1) {
                    // Count how many identical items (same heading text + level)
                    // appear BEFORE the selected item. This becomes our occurrence index.
                    //
                    // Example: dropdown shows [Intro, Methods, Intro, Results, Intro]
                    // If user picks the third "Intro" (index 4), we count 2 matches
                    // before it (indices 0 and 2), so occurrenceIndex = 2.
                    for (let i = 0; i < selectedIndex; i++) {
                        const suggestionValue = suggestionsArray[i]?.item || suggestionsArray[i];
                        if (suggestionValue &&
                            suggestionValue.heading === value.heading &&
                            suggestionValue.level === value.level) {
                            occurrenceIndex++;
                        }
                    }
                }
            }
        }
    } catch(e) {
        // If anything goes wrong accessing internal properties (which can happen
        // when Obsidian updates its private API), log a warning and fall through
        // with occurrenceIndex = 0 (first occurrence).
        console.warn("[GFM Heading Links] Could not determine dropdown occurrence", e);
    }

    // ─── STEP 2: Iterate the file cache and find the Nth matching heading ───
    const slugCounts = new Map<string, number>();
    let matchedOccurrences = 0;

    for (const heading of cache.headings) {
        // Generate the GFM slug for this heading (with collision suffix if needed).
        // This mirrors exactly what buildDocumentIndex does, ensuring consistency.
        const baseSlug = gfmSlugify(heading.heading);
        const count = slugCounts.get(baseSlug) || 0;
        const finalSlug = count === 0 ? baseSlug : `${baseSlug}-${count}`;
        slugCounts.set(baseSlug, count + 1);

        // Check if this heading matches the selected one (same text AND level).
        // Using both heading text and level prevents false matches when two
        // headings with the same text have different levels (e.g., # Intro vs ## Intro).
        if (heading.heading === value.heading && heading.level === value.level) {
            if (matchedOccurrences === occurrenceIndex) {
                // Found it! Return the complete link fragment with '#' prefix.
                return '#' + finalSlug;
            }
            matchedOccurrences++;
        }
    }

    // If we exhaust the cache without finding a match, something went wrong
    // (e.g., the dropdown showed a heading that's no longer in the file).
    // Return null and let the caller fall back to simple slugification.
    return null;
}

/**
 * Monkey-patches Obsidian's native EditorSuggest system to inject GFM slugs when users select heading suggestions from the autocomplete dropdown.
 *
 * ## How monkey-patching works here
 *
 * 1. We access `workspace.editorSuggest.suggests` — an internal array of all registered suggestor instances (file suggestor, heading suggestor, etc.).
 *
 * 2. For each suggestor that has a `selectSuggestion` method, we save a reference to the original method, then replace it with our wrapper.
 *
 * 3. Our wrapper inspects the `value` argument. If it looks like a heading suggestion (has `subpath` or nested `item.subpath`), we mutate the `subpath` to use the GFM slug format.
 *
 * 4. We then call the original method with the mutated value. Obsidian's native logic handles the actual text insertion — it just gets our modified text instead of the original.
 *
 * 5. The cleanup function (returned) restores all original methods when the plugin is unloaded.
 *
 * ## What we look for in the value object
 *
 * Obsidian's suggestion values have different shapes depending on the suggestor type. We handle two cases:
 *
 * **Case 1 — Direct properties (heading suggestor):**
 * ```ts
 * value = {
 *   heading: "My Heading",
 *   level: 1,
 *   file: TFile,
 *   subpath: "#My Heading"  // ← we rewrite this to "#my-heading"
 * }
 * ```
 *
 * **Case 2 — Nested item (generic suggestor):**
 * ```ts
 * value = {
 *   item: {
 *     heading: "My Heading",
 *     level: 1,
 *     subpath: "#My Heading"  // ← we rewrite this
 *   }
 * }
 * ```
 *
 * ## The two resolution strategies
 *
 * We try resolution in this priority order:
 *
 * 1. **`resolveGfmSlug()`** — The precise approach. Matches the dropdown position to the file's heading cache to get the exact slug with correct collision suffix. Used when the suggestor instance is available.
 *
 * 2. **`gfmSlugify()` fallback** — The simple approach. Directly slugifies the heading text. Correct for non-duplicate headings, but may miss the collision suffix for duplicates.
 *
 * @param plugin - The main GfmHeadingLinksPlugin instance, providing access
 *                 to `app.workspace.editorSuggest.suggests`.
 * @returns A cleanup function that restores all original `selectSuggestion`
 *          methods. Returns a no-op function if the suggests array is not found.
 */
export function applyEditorSuggestPatches(plugin: GfmHeadingLinksPlugin): () => void {
    // Access Obsidian's internal editor suggest registry.
    // This is an undocumented internal API — it may change between Obsidian versions.
    // We wrap the access in a type assertion to `any` because the TypeScript
    // definitions don't expose this property.
    const suggests = (plugin.app.workspace as any).editorSuggest?.suggests;

    // GUARD: If we can't find the suggests array (e.g., Obsidian changed its
    // internal API), bail out gracefully. The plugin will still work for
    // link clicks and hovers — only autocomplete slug rewriting will be disabled.
    if (!Array.isArray(suggests)) {
        console.warn("[GFM Heading Links] Could not find editor suggests array");
        return () => {}; // No-op cleanup
    }

    // We don't try to identify a specific "link suggestor" by class name because
    // Obsidian's internal class names are obfuscated and may change.
    // Instead, we patch ALL suggestors that have a selectSuggestion method.
    // If a suggestor doesn't deal with headings, our value inspection will
    // simply find nothing to mutate and pass through unchanged.
    const unpatchers: (() => void)[] = [];

    for (const suggest of suggests) {
        // Only patch suggestors that actually have a selectSuggestion method.
        // Some suggestor objects might be configuration or metadata, not actual suggestors.
        if (typeof suggest.selectSuggestion === "function") {
            // Save a reference to the original method.
            // This is the core of the monkey-patching pattern:
            // 1. Save original
            // 2. Replace with wrapper
            // 3. Cleanup restores original
            const originalSelectSuggestion = suggest.selectSuggestion;

            // Replace with our wrapper function.
            // We use a regular function (not arrow) so `this` refers to the suggestor
            // instance when the original method is called.
            suggest.selectSuggestion = function(value: any, evt: any) {
                // value is the suggestion object that was selected by the user.
                // evt is the keyboard/mouse event that triggered the selection.
                try {
                    debugLog("suggest:selected", { heading: value?.heading, level: value?.level });

                    // Only attempt mutation if the value is a non-null object.
                    // Primitive values (strings, numbers) are not heading suggestions.
                    if (value && typeof value === 'object') {
                        let mutated = false;

                        // ─── Case 1: Direct subpath property ───
                        // This is the common case for Obsidian's built-in heading suggestor.
                        // The `subpath` is the part after `#` in the link, e.g., "My Heading".
                        if (typeof value.subpath === 'string') {
                            // First try the precise resolution (handles duplicates correctly).
                            const exactSlug = resolveGfmSlug(value, plugin.app, this);
                            if (exactSlug) {
                                // exactSlug already includes the '#' prefix, e.g., "#my-heading-1".
                                value.subpath = exactSlug;
                            } else {
                                // Fall back to simple slugification.
                                // Strip existing '#' prefix if present, slugify, then re-add '#'.
                                const raw = value.subpath.startsWith('#')
                                    ? value.subpath.substring(1)
                                    : value.subpath;
                                value.subpath = '#' + gfmSlugify(raw);
                            }
                            mutated = true;
                        }

                        // ─── Case 2: Nested item.subpath property ───
                        // Some suggestors wrap the actual value in an `item` property.
                        // The logic is identical to Case 1, just one level deeper.
                        if (value.item && typeof value.item === 'object') {
                            if (typeof value.item.subpath === 'string') {
                                const exactSlug = resolveGfmSlug(value.item, plugin.app, this);
                                if (exactSlug) {
                                    value.item.subpath = exactSlug;
                                } else {
                                    const raw = value.item.subpath.startsWith('#')
                                        ? value.item.subpath.substring(1)
                                        : value.item.subpath;
                                    value.item.subpath = '#' + gfmSlugify(raw);
                                }
                                mutated = true;
                            }
                        }

                        // ─── Strip HTML from heading alias (Bug 7 fix) ───
                        // Headings containing inline HTML (e.g., "## Title <a id=\"x\"></a>") would otherwise preserve the raw HTML in the alias text. We strip AFTER slug resolution so the matching logic works correctly. `.trim()` removes whitespace left behind when the HTML tag was preceded/followed by spaces (e.g., "anchor <a>" → "anchor ").
                        //
                        //>[!QUESTION] Why there are 2 `if` statements? Are both necessary?
                        //>[!FIX]`value` is a weak name. Naming must be redone.
                        if (value.heading && typeof value.heading === 'string') {
                            value.heading = value.heading.replace(/<\/?[^>]+(>|$)/g, '').trim();
                        }
                        if (value.item?.heading && typeof value.item.heading === 'string') {
                            value.item.heading = value.item.heading.replace(/<\/?[^>]+(>|$)/g, '').trim();
                        }


                        // Log the mutation for debugging.
                        // This helps verify that our interception is working correctly.
                        if (mutated) {
                            debugLog("suggest:mutated", { subpath: value?.subpath || value?.item?.subpath });
                        }
                    }
                } catch (e) {
                    // If ANYTHING goes wrong in our interception, log the error and continue with the original method unchanged. We must never break the user's autocomplete — a broken suggestor is worse than one that just doesn't rewrite slugs.
                    console.error("[GFM Heading Links] Error in editorSuggest patch:", e);
                }

                // Always call the original method, even if our mutation failed. This ensures the autocomplete still works normally. We use .call(this, ...) to preserve the suggestor's `this` context.
                return originalSelectSuggestion.call(this, value, evt);
            };

            // Push a cleanup function that restores this suggestor's original method. When the plugin is unloaded, we iterate these and undo all patches.
            unpatchers.push(() => {
                suggest.selectSuggestion = originalSelectSuggestion;
            });
        }
    }

    // Return the master cleanup function. When called, it restores ALL patched suggestors to their original state.
    return () => {
        for (const unpatch of unpatchers) unpatch();
    };
}

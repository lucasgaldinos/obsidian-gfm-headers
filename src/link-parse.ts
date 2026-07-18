/**
 * Link Parsing & Normalization Layer.
 *
 * This module handles pre-processing of raw link slugs before they enter
 * the resolution pipeline. The resolution engine should receive clean slugs —
 * it should not know about cosmetic autocomplete decorations like prefix/suffix
 * affixes. This separation eliminates a bidirectional coupling anti-pattern
 * where `resolve-target.ts` imported `GfmSettings` to undo what
 * `patch-editor-suggest.ts` did with those same settings.
 *
 * ## Responsibilities
 *
 * 1. **URL decoding**: Defensively decodes URL-encoded slugs (e.g., `%20` → space).
 * 2. **Affix stripping**: Removes user-configured prefix/suffix characters
 *    applied during autocomplete (TASK-1002). These are cosmetic only.
 *
 * Callers (`patch-link-click.ts`, `patch-link-hover.ts`) normalize slugs
 * before passing them to `resolveGfmTarget()` / `resolveGfmTargetSync()`.
 *
 * Created per TASK-1011.
 */

import type { GfmSettings } from "./settings";

/**
 * Normalizes a raw link slug by URL-decoding and stripping cosmetic affixes.
 *
 * @param rawSlug - The raw slug fragment from a link (everything after `#`).
 * @param settings - Plugin settings containing prefix/suffix strings.
 *                   If undefined, no affix stripping is performed.
 * @returns The normalized slug ready for DocumentIndex lookup.
 *
 * @example
 * ```ts
 * normalizeSlug("§my-heading", { prefix: "§", suffix: "" })  // → "my-heading"
 * normalizeSlug("my-heading¶", { prefix: "", suffix: "¶" })   // → "my-heading"
 * normalizeSlug("my%20heading", { prefix: "", suffix: "" })    // → "my heading"
 * ```
 */
export function normalizeSlug(rawSlug: string, settings?: GfmSettings): string {
    let slug = rawSlug;

    // URL decode (defensive — GFM slugs shouldn't normally be encoded)
    try {
        slug = decodeURIComponent(slug);
    } catch {
        /* keep raw */
    }

    // Strip user-configured prefix/suffix (cosmetic autocomplete decorations)
    const prefix = settings?.prefix || "";
    const suffix = settings?.suffix || "";
    if (prefix && slug.startsWith(prefix)) {
        slug = slug.substring(prefix.length);
    }
    if (suffix && slug.endsWith(suffix)) {
        slug = slug.substring(0, slug.length - suffix.length);
    }

    return slug;
}

/**
 * Type Definitions for GFM Heading Links Plugin.
 *
 * This file is the **contract** of the plugin. Every interface and type defined here represents a data structure that flows between modules. By centralizing type definitions in one place, we ensure that:
 *
 * 1. All modules agree on the shape of data they exchange.
 * 2. TypeScript's compiler can catch mismatches at build time.
 * 3. New developers can understand the data model by reading one file.
 *
 * ## Data flow overview
 *
 * ```ascii
 * User types [[#my-heading]]
 *        │
 *        ▼
 * resolveGfmTarget() ──► ResolutionResult { type: "success", target: HeadingAnchorTarget, file: TFile }
 *        │
 *        ▼
 * patchWorkspace ──► Injects virtual block using target.position
 *        │
 *        ▼
 * Obsidian scrolls to target.line
 * ```
 *
 * The key types in this flow:
 * - `DocumentIndex`: The lookup table (slug → AnchorTarget)
 * - `AnchorTarget`: Either a heading or an HTML anchor
 * - `ResolutionResult`: The outcome of trying to resolve a slug
 */

import type { TFile } from "obsidian";

/**
 * Represents a markdown heading that has been resolved from a GFM slug.
 *
 * This is the primary target type — most GFM links point to headings. When a user writes `[[Note#my-heading]]`, the plugin looks up "my-heading" in the DocumentIndex and (if found) returns a `HeadingAnchorTarget` describing exactly where that heading lives.
 *
 * ## Why `position` is typed as `any`
 *
 * Obsidian's `Pos` type (from `obsidian` module) is complex and has changed between versions. Rather than importing and coupling to a specific Obsidian version's type definition, we use `any` here. The position object is only ever passed back to Obsidian's own APIs (like `cache.blocks`), so the exact type doesn't matter — Obsidian knows how to read its own format.
 *
 * If Obsidian ever exports a stable `Pos` type, we should replace `any` with that type for better type safety.
 */
export interface HeadingAnchorTarget {
    /** Discriminator for union type narrowing (HeadingAnchorTarget vs HtmlAnchorTarget). */
    type: "heading";

    /**
     * The GFM-compliant slug for this heading. Includes collision suffixes if applicable (e.g., "my-heading-1"). This is the value that users type after the `#` in their links.
     */
    slug: string;

    /**
     * The original heading text as it appears in the markdown source. Preserved for display/debugging purposes. Not used in slug resolution (that's what `slug` is for), but useful for logging and future UI features.
     */
    heading: string;

    /**
     * The heading level (1-6), corresponding to the number of `#` characters.
     * - 1 = `# Heading` (document title level)
     * - 2 = `## Heading` (section level)
     * - 3 = `### Heading` (subsection level)
     * - ...up to 6
     * Used for section boundary computation in `buildDocumentIndex`.
     */
    level: number;

    /**
     * The 0-based line number where this heading starts. This is the primary coordinate used for scrolling the editor view. Obtained from `heading.position.start.line` in Obsidian's HeadingCache.
     */
    line: number;

    /**
     * The 0-based line number where this heading's section ends. Computed by `buildDocumentIndex` as the line just before the next heading of equal or higher level, or the end of file if this is the last heading at its level.
     *
     * Used for:
     * - Virtual block injection (provides the section range for native scrolling)
     * - Fallback reveal (verifies the target is within bounds)
     */
    endLine: number;

    /**
     * The full position range object (start to end) for this heading's section. This is injected into `cache.blocks` as a virtual block so Obsidian's native scrolling mechanism can locate the target.
     *
     * Structure matches Obsidian's internal Pos format:
     * ```ts
     * {
     *   start: { line: number, col: number, offset: number },
     *   end:   { line: number, col: number, offset: number }
     * }
     * ```
     * Typed as `any` to avoid coupling to Obsidian's internal type definitions which may change between versions.
     */
    position?: any;
}

/**
 * Represents an HTML anchor tag found in raw markdown content.
 *
 * GFM supports `<a id="some-id"></a>` and `<a name="some-name"></a>` as valid anchor targets. These are commonly used in documentation imported from other platforms (e.g., GitBook, MkDocs, custom HTML templates).
 *
 * ## Differences from HeadingAnchorTarget
 *
 * - No `level` — HTML anchors don't have heading semantics.
 * - No `heading` text — the anchor has an `id`/`name`, not display text.
 * - Simpler position — just a line number, no section range needed.
 * - Lower priority — headings take precedence when slugs collide.
 *
 * ## Why `endLine` is `line + 1`
 *
 * An HTML anchor is a single-line element. There's no "section" concept like with headings. We set `endLine` to `line + 1` to represent a one-line span, which is sufficient for the virtual block injection trick.
 */
export interface HtmlAnchorTarget {
    /** Discriminator for union type narrowing. */
    type: "html-anchor";

    /**
     * The value of the `id` or `name` attribute on the anchor tag. This is what users type after `#` in their links. Example: for `<a id="custom-section"></a>`, slug is `"custom-section"`.
     */
    slug: string;

    /**
     * The 0-based line number where the anchor tag appears. Used for scrolling the editor to this position.
     */
    line: number;

    /**
     * The 0-based line number where this anchor's "section" ends. Always `line + 1` since anchors are single-line elements.
     */
    endLine: number;
}

/**
 * Union type for any resolvable anchor target in a document.
 *
 * Used throughout the codebase when a function needs to handle both heading targets and HTML anchor targets uniformly. TypeScript's discriminated union narrowing (checking `target.type`) allows safe access to type-specific properties.
 *
 * @example
 * ```ts
 * function handleTarget(target: AnchorTarget) {
 *   if (target.type === "heading") {
 *     console.log(`Heading level ${target.level}: ${target.heading}`);
 *   } else {
 *     console.log(`HTML anchor: ${target.slug}`);
 *   }
 * }
 * ```
 */
export type AnchorTarget = HeadingAnchorTarget | HtmlAnchorTarget;

/**
 * A lookup table mapping slug strings to their resolved anchor targets.
 *
 * This is the core data structure that powers the entire plugin. Every markdown file gets its own DocumentIndex, built by `buildDocumentIndex()` and `scanHtmlAnchors()`, cached by `IndexCache`.
 *
 * ## Why Map and not a plain object?
 *
 * - **Performance**: Map has O(1) lookup and insertion, optimized for frequent additions (which happens during index building).
 * - **Iteration order**: Map preserves insertion order (headings in document order), which is helpful for debugging.
 * - **Size tracking**: `map.size` is O(1); with objects you'd need `Object.keys().length`.
 * - **Key flexibility**: Though we only use strings now, Map supports any key type if we ever need it.
 *
 * ## Key format
 *
 * Keys are GFM slug strings, e.g.:
 * - `"introduction"` — simple heading
 * - `"my-heading-1"` — duplicate heading with collision suffix
 * - `"custom-id"` — HTML anchor id
 *
 * ## Value format
 *
 * >[!important]
 * >Values are `AnchorTarget` objects (either `HeadingAnchorTarget` or `HtmlAnchorTarget`), discriminated by their `type` field.
 */
export type DocumentIndex = Map<string, AnchorTarget>;

/**
 * The result of attempting to resolve a GFM slug to a navigation target.
 *
 * This is the return type of `resolveGfmTarget()`, the main resolution function. It uses a discriminated union pattern: the `type` field tells the caller which outcome occurred, and TypeScript narrows the available properties accordingly.
 *
 * ## Why three states instead of just success/failure?
 *
 * We need to distinguish between different failure modes to handle them appropriately:
 *
 * - **`success`**: We found the target. Navigate there (with virtual block injection or manual scrolling).
 *
 * - **`passthrough`**: This isn't a GFM link at all (e.g., it has uppercase, URL encoding, or is a block reference). We should let Obsidian's native handler deal with it. This is NOT an error — it's the expected outcome for Obsidian-style links.
 *
 * - **`file-not-found`**: The target file doesn't exist. This IS an error condition (broken link). The UI should show Obsidian's native "file not found" behavior.
 *
 * ## The `file` field on passthrough
 *
 * Even when we can't resolve the slug, we may have successfully resolved the file. For example, `[[ExistingNote#UPPERCASE-SLUG]]` — the file exists but the slug is in Obsidian format, not GFM. We return `type: "passthrough"` with the `file` set so Obsidian can at least open the right file.
 */
export interface ResolutionResult {
    /**
     * Discriminator indicating the outcome of resolution.
     *
     * - `"success"`: Slug was found in the document index. Use `target` and `file`.
     * - `"passthrough"`: Not a GFM slug — let Obsidian handle it natively.
     *                    `file` may still be set if the note path was resolved.
     * - `"file-not-found"`: The target file doesn't exist in the vault.
     *                       Neither `target` nor `file` will be set.
     */
    type: "success" | "passthrough" | "file-not-found";

    /**
     * The resolved anchor target (heading or HTML anchor).Only present when `type` is `"success"`.
     */
    target?: AnchorTarget;

    /**
     * The resolved TFile object for the target note. Present when `type` is `"success"` or `"passthrough"` (if the file was found). Undefined when `type` is `"file-not-found"`.
     */
    file?: TFile;
}

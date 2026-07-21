/**
 * Document Index Builder for GFM Heading Links Plugin.
 *
 * This module is the **brain** of the plugin's resolution system. It takes Obsidian's raw `CachedMetadata` (which contains heading positions, levels, and text) and transforms it into a `DocumentIndex` — a `Map<string, AnchorTarget>` that maps every resolvable GFM slug in a document to its exact location.
 *
 * ## What this module does
 *
 * 1. **`buildDocumentIndex`**: Iterates over Obsidian's heading cache, generates GFM slugs for each heading, handles duplicate heading collisions (appending `-1`, `-2`, etc.), and computes section boundaries (where each heading's content ends).
 *
 * 2. **`scanHtmlAnchors`**: Parses raw markdown file content looking for HTML `<a id="...">` and `<a name="...">` tags, which are an alternative way to create anchor targets in GFM-compatible documents.
 *
 * ## Why we need our own index
 *
 * Obsidian's native `metadataCache` already stores headings — so why not just use it directly? Two reasons:
 *
 * 1. **Slug mismatch**: Obsidian uses its own proprietary slugging algorithm (case-sensitive, space-preserving). GFM uses a different algorithm (lowercase, hyphen-separated, punctuation-stripped). We need to map between the two.
 *
 * 2. **Duplicate handling**: GFM appends `-1`, `-2`, etc. to duplicate headings. Obsidian does not track this suffix convention. Our index pre-computes the correct suffixed slugs so lookups are O(1) rather than O(n) scans.
 *
 * ## The section boundary problem
 *
 * One of the trickiest parts of this module is computing `endLine` for each heading. Obsidian's `HeadingCache` only tells us where a heading *starts*[^obs-1], not where its content section ends. We need this information for two reasons:
 *
 * - **Virtual block injection**: When we inject a temporary `^block` into Obsidian's metadata cache (the core trick that makes native scrolling work), we need a `position` spanning the full section so Obsidian's renderer knows where to scroll.
 *
 * - **Fallback reveal**: If virtual block injection fails, we fall back to manually scrolling the view. Having accurate `endLine` lets us verify that the target is within a reasonable range.
 *
 * [^obs-1]: How is the endline process done now? Because we could use a linked list or similar data structure of more efficiency, that tracked the next one. The end line must be the next header of the same or higher level.
 *
 * ## Performance considerations
 *
 * The heading iteration is O(n) where n is the number of headings in a file. For typical markdown files with dozens to a few hundred headings, this is negligible. For pathological files with thousands of headings, the nested loop (finding the next same-or-higher-level heading) could approach O(n²), but this is an extreme edge case. The fix note about V2 optimization acknowledges this — a single-pass algorithm using a stack would be more efficient but adds complexity that isn't justified yet. [^obs-2]
 *
 * [^obs-2]: Would like to know more about this. Please add a markdown link here to the code line number.
 */

import type { CachedMetadata } from "obsidian";

// HeadingCache is used implicitly via CachedMetadata.heading

import type { DocumentIndex, HeadingAnchorTarget, HtmlAnchorTarget } from "./types";
import { gfmSlugify, allocateUniqueSlug } from "./gfm-slugify";

/**
 * Builds a complete document index from Obsidian's cached heading metadata.
 *
 * This is the primary entry point for heading-based index construction. It takes the `CachedMetadata` object that Obsidian maintains for every markdown file (updated automatically on file changes) and produces a `Map` that answers the question: "given this GFM slug string, where exactly in the document should I navigate to?"
 *
 * ## Algorithm (step by step)
 *
 * ### Step 1: Slug generation and collision handling
 *
 * For each heading in the cache (ordered by line number, which Obsidian guarantees), we:
 *
 * 1. Run the heading text through `gfmSlugify()` to get the base slug (e.g., "My Heading" → "my-heading").
 * 2. Check a running `slugCounts` map to see if this base slug has been used before in this document.
 * 3. If it's the first occurrence, the final slug is just the base slug.
 * 4. If it's the Nth occurrence, the final slug is `{baseSlug}-{N-1}` (e.g., "my-heading", "my-heading-1", "my-heading-2").
 *
 * This matches GitHub's behavior exactly: the first duplicate gets no suffix, the second gets `-1`, the third gets `-2`, etc.
 *
 * ### Step 2: Section boundary computation
 *
 * For each heading at index `i`, we scan forward through headings `i+1` through the end of the array looking for the first heading whose `level` is ≤ the current heading's level [^obs-3]. That next heading's start line minus 1 is our section's `endLine`.
 *
 * [^obs-3]: What is the name of this algorithm?
 *
 * In markdown, a heading's "section" extends from its own line down to (but not including) the next heading of equal or higher rank. For example:
 *
 * ```markdown
 * # H1 (level 1)       ← section starts here
 * content...
 * ## H2 (level 2)      ← inside H1's section
 * more content...
 * # Another H1 (level 1) ← H1's section ends at line before this
 * ```
 *
 * If no subsequent heading of equal-or-higher level is found, the section extends to the end of the file (using the last known section offset from Obsidian's cache).
 *
 * ### Step 3: Position object construction
 *
 * We construct a synthetic `position` object that spans the entire section (from heading start to section end). This is critical for the virtual block injection trick used in `patch-workspace.ts` — Obsidian's native scrolling needs a position range to know where the "block" is.
 *
 * ### Step 4: Map insertion
 *
 * The fully-constructed `HeadingAnchorTarget` is inserted into the index Map keyed by its final (possibly suffixed) slug string.
 *
 * @param cache - Obsidian's `CachedMetadata` for a file, obtained via `app.metadataCache.getFileCache(file)`. May have empty or missing `headings` array for files with no headings.
 * @returns A `DocumentIndex` (Map of slug → AnchorTarget). Empty map if the file has no headings.
 *
 * @example
 * ```ts
 * const cache = app.metadataCache.getFileCache(file);
 * const index = buildDocumentIndex(cache || { headings: [] });
 * const target = index.get("my-heading"); // O(1) lookup
 * if (target) {
 *   console.log(`Found at line ${target.line}, ends at ${target.endLine}`);
 * }
 * ```
 */
export function buildDocumentIndex(cache: CachedMetadata): DocumentIndex {
    const index: DocumentIndex = new Map();
    const headings = cache.headings || [];

    if (headings.length === 0) return index;

    // Determine the end-of-file boundary for headings whose section extends
    // to the end of the document (no subsequent same-or-higher-level heading).
    const lastHeading = headings[headings.length - 1];
    let eofLine = lastHeading.position.start.line;
    let eofOffset: number | undefined;
    if (cache.sections && cache.sections.length > 0) {
        eofOffset = cache.sections[cache.sections.length - 1].position.end.offset;
    }

    // ─── PASS 1: Compute section boundaries using a stack (O(n)) ───
    // Stack holds indices of headings whose sections haven't been "closed"
    // yet by a subsequent heading of equal or higher level.
    // Replaces the previous O(n²) nested loop (TASK-1009).
    const endLines: number[] = new Array<number>(headings.length).fill(0);
    const endOffsets: (number | undefined)[] = new Array<number | undefined>(headings.length);
    const stack: number[] = [];

    for (let i = 0; i < headings.length; i++) {
        const current = headings[i];

        // Pop headings from the stack that are "closed" by this heading.
        // A level-2 heading's section ends when we encounter another
        // level-2 or level-1 heading (current.level <= popped.level).
        while (stack.length > 0 && current.level <= headings[stack[stack.length - 1]].level) {
            const poppedIdx = stack.pop()!;
            endLines[poppedIdx] = current.position.start.line - 1;
            endOffsets[poppedIdx] = current.position.start.offset;
        }

        stack.push(i);
    }

    // Remaining stack entries extend to end of file
    while (stack.length > 0) {
        const idx = stack.pop()!;
        endLines[idx] = eofLine;
        endOffsets[idx] = eofOffset;
    }

    // ─── PASS 2: Build HeadingAnchorTarget entries ───
    for (let i = 0; i < headings.length; i++) {
        const heading = headings[i];

        // STEP 1: Generate the base GFM slug from the heading's display text.
        const baseSlug = gfmSlugify(heading.heading);

        // STEP 2: Handle duplicate heading collisions with GFM-style suffixes.
        const finalSlug = allocateUniqueSlug(baseSlug, index);

        // STEP 3: Build section position from pre-computed boundaries.
        const endLine = endLines[i];
        const endOffset = endOffsets[i];

        const sectionPosition = {
            start: heading.position.start,
            end: endOffset
                ? { line: endLine, col: 0, offset: endOffset }
                : heading.position.end
        };

        // STEP 4: Build the HeadingAnchorTarget and insert into the index.
        const target: HeadingAnchorTarget = {
            type: "heading",
            slug: finalSlug,
            heading: heading.heading,
            level: heading.level,
            line: heading.position.start.line,
            endLine: Math.max(heading.position.start.line, endLine),
            position: sectionPosition
        };

        index.set(finalSlug, target);
    }

    return index;
}

/**
 * Scans raw markdown file content for HTML anchor elements.
 *
 * GFM (GitHub Flavored Markdown) allows HTML anchors as an alternative
 * way to define link targets within a document. The two supported forms are:
 *
 * ```html
 * <a id="my-custom-id"></a>
 * <a name="old-style-name"></a>
 * ```
 *
 * Both `id` and `name` attributes are recognized. The `name` attribute is
 * technically deprecated in HTML5 but still widely used and supported by
 * GitHub's renderer, so we support it for compatibility.
 *
 * ## How it works
 *
 * 1. The file content is split into individual lines (by `\n`).
 * 2. Each line is tested against a regex that matches `<a>` tags with
 *    either an `id` or `name` attribute.
 * 3. The regex uses the `gi` flags:
 *    - `g` (global): Find ALL matches on a line (a single line could have
 *      multiple anchors, though that's unusual).
 *    - `i` (case-insensitive): Match `<A>`, `<a>`, `ID`, `id`, `Name`, `name`, etc.
 * 4. For each match, we record the captured attribute value as the slug
 *    and the line index (0-based) as the position.
 *
 * ## Why scan raw content instead of using the metadata cache?
 *
 * Obsidian's `CachedMetadata` does not track HTML anchors — it only tracks
 * markdown headings. To support users who use HTML anchors (common in
 * technical documentation ported from other platforms), we must parse the
 * raw file text ourselves.
 *
 * ## Performance note
 *
 * This function processes the entire file content as a string split,
 * which allocates an array of all lines. For very large files (10k+ lines),
 * this could be memory-intensive. A streaming line-by-line approach using
 * indexOf would be more efficient, but adds complexity. Given that most
 * markdown files are well under 10k lines, the current approach is fine.
 *
 * @param fileContent - The complete raw text content of a markdown file,
 *                      obtained via `app.vault.read(file)`.
 * @returns An array of `HtmlAnchorTarget` objects, one per discovered anchor.
 *          Empty array if no HTML anchors are found.
 *
 * @example
 * ```ts
 * const content = await app.vault.read(file);
 * const anchors = scanHtmlAnchors(content);
 * // anchors = [
 * //   { type: "html-anchor", slug: "custom-id", line: 5, endLine: 6 },
 * //   { type: "html-anchor", slug: "old-name", line: 10, endLine: 11 }
 * // ]
 * ```
 */
export function scanHtmlAnchors(fileContent: string): HtmlAnchorTarget[] {
    // Accumulator for discovered anchor targets.
    const anchors: HtmlAnchorTarget[] = [];

    // Split the file into lines so we can report 0-based line numbers.
    // This is consistent with how Obsidian reports heading positions.
    const lines = fileContent.split('\n');

    // Regex explanation (breaking it down):
    //
    // /<a                          — literal opening of anchor tag
    // \s+                          — at least one whitespace after "a"
    // (?:[^>]*?\s+)?               — non-capturing optional group: any attributes before id/name
    // (?:id|name)                  — non-capturing group: match either "id" or "name"
    // =                            — literal equals sign
    // ["']                         — opening quote (single or double)
    // ([^"']+)                     — CAPTURING GROUP 1: the actual value (one or more non-quote chars)
    // ["']                         — closing quote (must match opening type)
    // [^>]*                        — any remaining attributes before the closing >
    // >                            — literal closing of the tag
    // /gi                          — global + case-insensitive flags
    //
    // This regex intentionally does NOT handle:
    // - Unquoted attribute values (<a id=foo>) — invalid HTML but some parsers accept it
    // - Self-closing tags (<a id="foo" />) — would match anyway since the > handles it
    // - Multi-line anchor tags — rare edge case, not worth the regex complexity
    const anchorRegex = /<a\s+(?:[^>]*?\s+)?(?:id|name)=["']([^"']+)["'][^>]*>/gi;

    // Iterate over each line with its 0-based index.
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let match;

        // regex.exec() is used in a loop because of the /g flag.
        // Each call advances lastIndex and returns the next match.
        // When no more matches exist, exec() returns null and the loop exits.
        // We MUST use a local variable (not regex.exec directly in while condition)
        // to avoid infinite loops from certain regex patterns.
        while ((match = anchorRegex.exec(line)) !== null) {
            // match[0] = the full matched string (e.g., '<a id="foo">')
            // match[1] = the first capturing group (e.g., 'foo')
            anchors.push({
                type: "html-anchor",
                slug: match[1],           // The captured id/name value
                line: i,                   // 0-based line index
                endLine: i + 1             // Section spans exactly one line (the anchor itself)
            });
        }
    }

    return anchors;
}
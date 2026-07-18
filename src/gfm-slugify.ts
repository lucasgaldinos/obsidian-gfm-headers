/**
 * GFM (GitHub Flavored Markdown) Slugification Function.
 *
 * This module implements the exact heading-to-slug algorithm used by GitHub when rendering markdown files. Every heading in a GitHub README, issue, or wiki page gets an auto-generated `id` attribute that follows these rules.
 *
 * ## Why this matters for the plugin
 *
 * Obsidian uses its **own** slugging algorithm that is fundamentally different from GFM:
 *
 * | Feature | Obsidian (OFM) | GitHub (GFM) |
 * |---------|----------------|--------------|
 * | Case | Preserved | Lowercased |
 * | Spaces | Preserved | Replaced with `-` |
 * | Punctuation | Preserved (mostly) | Stripped |
 * | Unicode | Limited support | Full Unicode (via `\p{L}\p{N}`) |
 * | Underscores | Preserved | Preserved |
 *
 * This means a heading like `"My Heading: Part 1"` produces:
 * - Obsidian: `#My Heading: Part 1` (essentially raw text)
 * - GFM: `#my-heading-part-1` (transformed)
 *
 * Because this plugin's entire purpose is to make Obsidian understand GFM-style links, we need to be able to **generate** GFM slugs (for the editor suggest patch) and **look up** GFM slugs (for the document index). This function is the single source of truth for that transformation.
 *
 * ## The GFM specification (informal)
 *
 * GitHub's actual slugification algorithm is implemented in their closed-source renderer, but the community has reverse-engineered the rules through extensive testing. The authoritative reference is the `github-slugger` npm package and various community spec documents. The rules are:
 *
 * 1. **Lowercase** the entire string.
 * 2. **Remove** all punctuation characters except hyphens (`-`) and underscores (`_`).
 * 3. **Replace** any sequence of whitespace characters with a single hyphen (`-`).
 * 4. **Collapse** consecutive hyphens into a single hyphen.
 * 5. **Trim** leading and trailing hyphens.
 * 6. **Preserve** Unicode letters and numbers (including non-Latin scripts).
 *
 * ## The regex breakdown
 *
 * The implementation uses a chain of `.replace()` calls for clarity. Each step handles one transformation rule. Let's trace through an example:
 *
 * ```ts
 * gfmSlugify("  Héllo, World! How are you?  ")
 * ```
 *
 * Step-by-step:
 * ```
 * ".toLowerCase()"           → "  héllo, world! how are you?  "
 * ".replace(/[^\p{L}\p{N}\s\-_]/gu, '')" → "  héllo world how are you  "
 * ".trim()"                  → "héllo world how are you"
 * ".replace(/\s+/g, '-')"    → "héllo-world-how-are-you"
 * ".replace(/-+/g, '-')"     → "héllo-world-how-are-you" (no change, no consecutive hyphens)
 * ".replace(/^-+|-+$/g, '')" → "héllo-world-how-are-you" (no change, no leading/trailing hyphens)
 * ```
 *
 * Result: `"héllo-world-how-are-you"`
 *
 * ## Unicode support
 *
 * The regex uses `\p{L}` (any Unicode letter) and `\p{N}` (any Unicode number) with the `u` (unicode) flag. This means it correctly handles:
 * - CJK characters: 你好 → 你好 (preserved as-is, no spaces to replace)
 * - Cyrillic: Привет → привет (lowercased)
 * - Accented Latin: déjà → déjà (preserved)
 * - Arabic, Hebrew, Thai, etc.
 *
 * This is critical for international users who write documentation in non-English languages. GitHub itself supports this, so we must too.
 */

/**
 * Converts a human-readable heading string into a GFM-compliant URL slug.
 *
 * This is the canonical slugification function used throughout the plugin. Every other module that needs to generate or match GFM slugs calls this function, ensuring consistency. If the slug rules ever need to change (e.g., to match a GitHub specification update), they only need to change in this one place.
 *
 * ## Transformation pipeline
 *
 * The function applies five transformations in sequence. The order matters: we lowercase and strip punctuation BEFORE replacing whitespace, because punctuation characters next to spaces would otherwise create double hyphens.
 *
 * 1. **`.toLowerCase()`** — Normalize case. GFM slugs are always lowercase. This uses JavaScript's default locale-aware lowercasing, which correctly handles most scripts (Turkish İ is a known edge case, but extremely unlikely to affect markdown headings).
 *
 * 2. **`.replace(/[^\p{L}\p{N}\s\-_]/gu, '')`** — Strip punctuation.
 *
 *    The regex keeps only:
 *    - `\p{L}`: Unicode letters (any script)
 *    - `\p{N}`: Unicode numbers
 *    - `\s`: Whitespace (to be replaced in step 4)
 *    - `\-`: Literal hyphens
 *    - `_`: Underscores (GFM preserves these)
 *    Everything else (commas, periods, exclamation marks, emoji, symbols) is removed entirely.
 *
 * 3. **`.trim()`** — Remove leading and trailing whitespace. This prevents leading/trailing hyphens from forming in step 4.
 *
 *    Example: `"  hello  "` → `"hello"` (after trim) → `"hello"` vs. without trim: `"  hello  "` → `"--hello--"` → `"-hello-"` (ugly).
 *
 * 4. **`.replace(/\s+/g, '-')`** — Replace whitespace sequences with hyphens. Multiple consecutive spaces/tabs/newlines become a single hyphen.
 *
 *    `"hello   world"` → `"hello-world"` (not `"hello---world"`).
 *
 * 5. **`.replace(/-+/g, '-')`** — Collapse consecutive hyphens.  If step 2 removed punctuation that was surrounded by hyphens (or if the  input already had multiple hyphens), this collapses them.
 *
 *    `"a - b"` → after step 2: `"a  - b"` → after step 4: `"a---b"` → `"a-b"`.
 *
 * 6. **`.replace(/^-+|-+$/g, '')`** — Trim leading/trailing hyphens. If the input started or ended with punctuation that was stripped, the resulting slug shouldn't have hyphens at the boundaries.
 *
 *    `"-hello-"` → `"hello"`.
 *
 * @param text - The raw heading text as it appears in the markdown source,
 *               e.g., `"My Heading"`, `"## Getting Started"`, `"Café & Crème"`.
 *               Note: the `#` marks and leading whitespace should already be
 *               stripped by Obsidian's parser before this is called.
 * @returns The GFM-compliant slug string. May be empty string `""` if the
 *          input consisted entirely of punctuation/whitespace (unlikely for
 *          real headings, but handled gracefully).
 *
 * @example
 * ```ts
 * gfmSlugify("Hello World")           // → "hello-world"
 * gfmSlugify("My Heading: Part 1")    // → "my-heading-part-1"
 * gfmSlugify("Café & Crème")          // → "café-crème"
 * gfmSlugify("  Multiple   Spaces  ") // → "multiple-spaces"
 * gfmSlugify("keep_underscores")      // → "keep_underscores"
 * gfmSlugify("你好，世界！")            // → "你好世界"
 * gfmSlugify("---")                   // → ""
 * ```
 */
export function gfmSlugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s\-_]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Allocates a unique slug by appending GFM collision suffixes (-1, -2, ...)
 * until a slug not present in `usedSlugs` is found.
 *
 * This is the single source of truth for collision resolution, used by both
 * `buildDocumentIndex` (click navigation) and `resolveGfmSlug` (autocomplete).
 * Keeping it in one place ensures both systems produce identical slugs and
 * prevents the cross-baseSlug collision bug from recurring.
 *
 * ## Cross-baseSlug collision handling
 *
 * Unlike a per-baseSlug counter (which is blind to slugs claimed by different
 * heading texts), this function checks the actual set of used slugs. This means:
 *
 * - Literal `## Commands-1` claims `commands-1`.
 * - Duplicate `## Commands` checks `commands-1` → already used → skips to `commands-2`.
 *
 * @param baseSlug - The base GFM slug (from `gfmSlugify()`), e.g., `"commands"`.
 * @param usedSlugs - Any object with a `has()` method for membership checks
 *                    (e.g., `Set<string>`, `Map<string, unknown>`, or a plain
 *                    `{ has(key: string): boolean }` adapter). The function
 *                    only reads — it never mutates the collection.
 * @returns The first available slug: `baseSlug` if unused, or `baseSlug-N`
 *          where N is the smallest positive integer that avoids collision.
 *
 * @example
 * ```ts
 * const used = new Set<string>();
 * allocateUniqueSlug("intro", used);        // → "intro"
 * allocateUniqueSlug("intro", used);        // → "intro-1"
 * allocateUniqueSlug("intro", used);        // → "intro-2"
 * allocateUniqueSlug("intro-1", used);      // → "intro-1-1" (cross-baseSlug!)
 * ```
 */
export function allocateUniqueSlug(
  baseSlug: string,
  usedSlugs: { has(key: string): boolean },
): string {
  let finalSlug = baseSlug;
  let suffix = 0;
  while (usedSlugs.has(finalSlug)) {
    suffix++;
    finalSlug = `${baseSlug}-${suffix}`;
  }
  return finalSlug;
}

/**
 * Determines whether a link slug fragment matches GFM heading slug conventions.
 *
 * GFM slugs are always lowercase, never URL-encoded, and never start with
 * block-reference (`^`) or footnote (`[^`) prefixes. This predicate is the
 * single source of truth for the GFM-vs-OFM detection heuristic, used by both
 * `resolveGfmTarget()` (click navigation) and the hover-link interceptor.
 *
 * ## Why this is a shared function
 *
 * Previously this logic was duplicated verbatim in `resolve-target.ts` and
 * `patch-workspace.ts`. Extracting it into a single predicate ensures both
 * consumers stay in sync and satisfies the Open/Closed Principle — new guard
 * conditions only need to be added in one place.
 *
 * @param slug - The raw slug fragment from a link (everything after `#`).
 * @returns `true` if the slug matches GFM conventions (lowercase, no URL
 *          encoding, not a block ref or footnote). `false` if it looks like
 *          Obsidian's native format (uppercase, spaces, URL-encoded) or is
 *          a block/footnote reference that Obsidian should handle natively.
 *
 * @example
 * ```ts
 * isGfmSlug("my-heading")      // → true  (lowercase, hyphenated)
 * isGfmSlug("My Heading")      // → false (uppercase = Obsidian format)
 * isGfmSlug("my%20heading")    // → false (URL-encoded = Obsidian format)
 * isGfmSlug("^block-id")       // → false (block reference)
 * isGfmSlug("[^footnote]")     // → false (footnote reference)
 * isGfmSlug("")                // → false (empty slug)
 * ```
 */
export function isGfmSlug(slug: string): boolean {
  return (
    slug.length > 0 &&
    !/[A-Z]/.test(slug) &&
    !/%[0-9A-Fa-f]{2}/.test(slug) &&
    !slug.startsWith("^") &&
    !slug.startsWith("[^")
  );
}

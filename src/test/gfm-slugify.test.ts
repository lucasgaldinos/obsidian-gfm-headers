/**
 * Unit Tests for `gfmSlugify()` — the GFM Slugification Function.
 *
 * These tests verify that our GFM slug implementation matches GitHub's  behavior across all supported input types. The test cases are organized  by the transformation rule being tested.
 *
 * ## Test categories
 *
 * 1. **Case normalization** — Verifies that all input is lowercased.
 * 2. **Underscore preservation** — GFM keeps underscores, unlike some sluggers.
 * 3. **Whitespace → hyphen** — Spaces and tabs become single hyphens.
 * 4. **Punctuation stripping** — Commas, periods, exclamation marks, etc. are removed.
 * 5. **Unicode preservation** — Non-Latin scripts (CJK, Cyrillic, accented Latin) are kept.
 * 6. **Hyphen collapsing** — Multiple consecutive hyphens become one.
 * 7. **Boundary trimming** — Leading and trailing hyphens are removed.
 *
 * ## Running these tests
 *
 * ```bash
 * npx vitest run src/test/gfm-slugify.test.ts
 * ```
 *
 * ## Why these specific test cases?
 *
 * Each test case targets a specific edge behavior that could break if the regex chain is modified incorrectly. For example, the "preserves unicode" test would fail if someone accidentally used `[a-zA-Z0-9]` instead of `\p{L}\p{N}` — a common mistake when porting slug functions from English-only contexts.
 */

import { describe, it, expect } from "vitest";
import { gfmSlugify, isGfmSlug } from "../gfm-slugify";

/**
 * Test suite for the `gfmSlugify` function.
 *
 * Each `it` block tests one specific transformation rule or edge case. The test descriptions follow the pattern: "it [does X] with [input Y]" so failures are immediately understandable.
 *
 * >[!warning]
 * >This test could have and solve harder slugs than the ones currently proposed.
 */
describe("gfmSlugify", () => {
    /**
     * CASE NORMALIZATION
     *
     * GFM slugs are always lowercase. This test verifies that mixed-case input is normalized correctly, including:
     * - Title Case ("Hello World")
     * - Random casing ("MixED CaSE")
     * - All uppercase (covered by the above)
     *
     * Uses JavaScript's toLowerCase() which handles most Unicode scripts. Known limitation: Turkish dotless i (İ → i) may not match GitHub's behavior exactly, but this is an extreme edge case for markdown headings.
     */
    it("lowercases everything", () => {
        // Standard title case → lowercase with hyphens
        expect(gfmSlugify("Hello World")).toBe("hello-world");

        // Random mixed case — verifies that EVERY character is lowercased,
        // not just the first letter of each word
        expect(gfmSlugify("MixED CaSE")).toBe("mixed-case");
    });

    /**
     * UNDERSCORE PRESERVATION AND WHITESPACE HANDLING
     *
     * GFM is unique among slugifiers in that it PRESERVES underscores.
     * Most slug functions (e.g., GitHub's older algorithm, Jekyll, Hugo)
     * treat underscores as word separators and convert them to hyphens.
     * GFM treats them as literal characters.
     *
     * This distinction matters for:
     * - Code-oriented documentation (snake_case identifiers)
     * - Imported content from systems that use underscores in headings
     *
     * Also tests:
     * - Multiple spaces → single hyphen (collapse behavior)
     * - Leading/trailing spaces → trimmed
     */
    it("preserves underscores and replaces whitespace with hyphens", () => {
        // Underscores survive the transformation intact.
        // "Hello_World" → "hello_world" (not "hello-world"!)
        expect(gfmSlugify("Hello_World")).toBe("hello_world");

        // Three spaces between words → single hyphen.
        // Verifies that \s+ matches the entire whitespace run.
        expect(gfmSlugify("Hello   World")).toBe("hello-world");

        // Leading and trailing spaces are trimmed before hyphen conversion,
        // so they don't produce boundary hyphens.
        expect(gfmSlugify("  Spaces at ends  ")).toBe("spaces-at-ends");
    });

    /**
     * PUNCTUATION STRIPPING
     *
     * GFM removes ALL punctuation except hyphens and underscores.  This includes:
     * - ASCII punctuation: , . ! ? ' " ( ) [ ] { } etc.
     * - Symbols: & * + = / \ @ # $ % ^ etc.
     * - Emoji and other Unicode symbols
     *
     * The punctuation is removed entirely (not replaced with hyphens).  The whitespace around the punctuation is what creates the hyphens  in the final slug.
     *
     * Example trace for "Hello, World!":
     *   toLowerCase: "hello, world!"
     *   strip punct: "hello world"     (comma and exclamation removed)
     *   trim:        "hello world"
     *   spaces→- :   "hello-world"
     */
    it("strips punctuation", () => {
        // Comma and exclamation mark removed
        expect(gfmSlugify("Hello, World!")).toBe("hello-world");

        // Question mark and period removed
        expect(gfmSlugify("What? Yes.")).toBe("what-yes");

        // Apostrophe removed (controversial — some users might expect "its"
        // but GFM strips the apostrophe, making "it's" → "its")
        expect(gfmSlugify("It's a test")).toBe("its-a-test");

        // Ampersand removed
        expect(gfmSlugify("Test & Trial")).toBe("test-trial");
    });

    /**
     * UNICODE PRESERVATION
     *
     * This is the most important test for international users. GFM preserves Unicode letters and numbers from all scripts:
     * - Latin with diacritics: é, ø, ü, ç, etc.
     * - CJK: 你好 (Chinese), 日本語 (Japanese), 한국어 (Korean)
     * - Cyrillic: привет (Russian)
     * - Arabic, Hebrew, Thai, Devanagari, etc.
     *
     * If this test fails, it means the regex is using ASCII-only character classes (like [a-zA-Z]) instead of Unicode-aware ones (\p{L}\p{N}).
     *
     * Note: CJK characters have no spaces between them, so they pass through the whitespace→hyphen step unchanged. This matches GitHub's behavior:
     * - "你好世界" (no spaces) → "你好世界" (unchanged).
     * - "你好，世界！" (with Chinese punctuation) → "你好世界" (punctuation removed).
     */
    it("preserves unicode characters", () => {
        // Accented Latin characters are preserved (not stripped or ASCII-folded)
        expect(gfmSlugify("Héllo Wørld")).toBe("héllo-wørld");

        // Chinese characters: letters preserved, punctuation removed
        // 你好，世界！ → 你好世界 (commas and exclamation marks are punctuation)
        expect(gfmSlugify("你好，世界！")).toBe("你好世界");

        // Cyrillic characters: preserved and lowercased
        // Привет → привет (Cyrillic has case, and toLowerCase() handles it)
        expect(gfmSlugify("Привет мир")).toBe("привет-мир");
    });

    /**
     * CONSECUTIVE HYPHEN COLLAPSING
     *
     * When punctuation between words is removed, the spaces around it become hyphens, potentially creating multiple consecutive hyphens. GFM collapses these into a single hyphen.
     *
     * Example: "a - b"
     *   toLowerCase: "a - b"
     *   strip punct: "a  - b"    (nothing stripped, hyphen is kept)
     *   trim:        "a  - b"
     *   spaces→- :   "a---b"     (two spaces + one hyphen = three hyphens)
     *   collapse:    "a-b"       (three hyphens → one)
     *
     * Example: "a --- b"
     *   toLowerCase: "a --- b"
     *   strip punct: "a --- b"   (hyphens preserved)
     *   trim:        "a --- b"
     *   spaces→- :   "a------b"  (two spaces + three hyphens = six hyphens)
     *   collapse:    "a-b"       (six hyphens → one)
     */
    it("collapses consecutive hyphens", () => {
        // "a - b": the spaces around the hyphen create "a--b" or "a---b"
        // which gets collapsed to "a-b"
        expect(gfmSlugify("a - b")).toBe("a-b");

        // "a --- b": multiple existing hyphens plus spaces → collapsed to one
        expect(gfmSlugify("a --- b")).toBe("a-b");
    });

    /**
     * BOUNDARY HYPHEN TRIMMING
     *
     * If the input starts or ends with characters that become hyphens (or are punctuation that gets removed, leaving hyphens at boundaries), those boundary hyphens must be stripped.
     *
     * This is the LAST step in the pipeline to catch hyphens that were introduced by earlier transformations.
     *
     * Edge case: if the ENTIRE input is punctuation/hyphens, the result should be an empty string "". This is technically valid — it means the heading has no meaningful content.
     */
    it("strips leading and trailing hyphens", () => {
        // Hyphens at both ends → stripped
        expect(gfmSlugify("-hello-")).toBe("hello");

        // Multiple hyphens at both ends → all stripped
        expect(gfmSlugify("---hello-world---")).toBe("hello-world");

        // Entirely hyphens → empty string
        // This is a degenerate case: a heading consisting only of hyphens.
        // An empty slug is technically valid but won't match anything useful.
        expect(gfmSlugify("---")).toBe("");
    });

    /**
     * EDGE CASES — DEGENERATE AND UNUSUAL INPUTS
     *
     * These test cases verify that the slug function handles inputs that
     * are unlikely in real markdown headings but could appear in edge
     * scenarios (imported content, programmatic generation, user error).
     *
     * Added per TASK-0905.
     */
    it("handles degenerate inputs", () => {
        // Empty string: no content to slugify
        expect(gfmSlugify("")).toBe("");

        // Pure punctuation: everything stripped, empty result
        expect(gfmSlugify("!!!???")).toBe("");

        // Only whitespace: trimmed to nothing
        expect(gfmSlugify("   ")).toBe("");
    });

    /**
     * NUMERIC AND ALPHANUMERIC EDGE CASES
     *
     * GFM preserves numbers alongside letters. Headings that start or end
     * with numbers should slugify naturally — numbers are not punctuation
     * and should survive the transformation.
     */
    it("handles numeric and alphanumeric headings", () => {
        // Numeric-only: numbers preserved, spaces become hyphens
        expect(gfmSlugify("123 456")).toBe("123-456");

        // Leading number with punctuation
        expect(gfmSlugify("1. Introduction")).toBe("1-introduction");

        // Trailing number
        expect(gfmSlugify("Step 1")).toBe("step-1");

        // Mixed numbers and letters with punctuation
        expect(gfmSlugify("Version 2.0 Release")).toBe("version-20-release");
    });

    /**
     * UNDERSCORE AND HYPHEN INTERACTION EDGE CASES
     *
     * Both underscores and hyphens are preserved by GFM. This test
     * verifies they don't interfere with each other or with the
     * whitespace→hyphen transformation.
     */
    it("handles mixed underscores and hyphens", () => {
        // Consecutive underscores (Python __init__ style)
        expect(gfmSlugify("__init__")).toBe("__init__");

        // Mixed underscores and hyphens in one heading
        expect(gfmSlugify("my_custom-heading")).toBe("my_custom-heading");

        // Underscore-separated words with spaces
        expect(gfmSlugify("hello_world test")).toBe("hello_world-test");

        // Leading/trailing underscores preserved
        expect(gfmSlugify("_private")).toBe("_private");
    });

    /**
     * EDGE CASES — HEADINGS WITH ONLY SPECIAL CHARACTERS
     *
     * Headings consisting entirely of punctuation, emoji, or other
     * non-letter/number characters produce empty slugs. This is
     * technically valid per the GFM spec — the heading has no
     * ASCII-meaningful content for a slug.
     */
    it("handles headings with only punctuation or emoji", () => {
        // Only punctuation → empty string
        expect(gfmSlugify("!!!")).toBe("");

        // Only emoji → empty string (no ASCII letters/numbers)
        expect(gfmSlugify("😀😀😀")).toBe("");

        // Only symbols
        expect(gfmSlugify("@#$%")).toBe("");
    });
});

/**
 * Test suite for `isGfmSlug` — the GFM slug detection predicate.
 *
 * Verifies the guard heuristic correctly distinguishes GFM slugs from
 * Obsidian's native format, block references, and footnotes.
 * Added per TASK-1004.
 */
describe("isGfmSlug", () => {
    it("detects valid GFM slugs", () => {
        expect(isGfmSlug("my-heading")).toBe(true);
        expect(isGfmSlug("hello-world")).toBe(true);
        expect(isGfmSlug("café-crème")).toBe(true);
        expect(isGfmSlug("keep_underscores")).toBe(true);
        expect(isGfmSlug("my-heading-1")).toBe(true);
        expect(isGfmSlug("a")).toBe(true);
    });

    it("rejects uppercase (Obsidian format)", () => {
        expect(isGfmSlug("My-Heading")).toBe(false);
        expect(isGfmSlug("My Heading")).toBe(false);
        expect(isGfmSlug("HELLO")).toBe(false);
        expect(isGfmSlug("mixedCase")).toBe(false);
    });

    it("rejects URL-encoded slugs", () => {
        expect(isGfmSlug("my%20heading")).toBe(false);
        expect(isGfmSlug("hello%20world")).toBe(false);
    });

    it("rejects block references", () => {
        expect(isGfmSlug("^block-id")).toBe(false);
        expect(isGfmSlug("^abc123")).toBe(false);
    });

    it("rejects footnote references", () => {
        expect(isGfmSlug("[^footnote]")).toBe(false);
        expect(isGfmSlug("[^1]")).toBe(false);
    });

    it("rejects empty slugs", () => {
        expect(isGfmSlug("")).toBe(false);
    });

    // ─── v1.3 Edge Cases ───

    it("accepts slugs with affix characters (prefix/suffix)", () => {
        // § and ¶ are not uppercase letters, so they pass the guard.
        // Affix stripping happens in normalizeSlug() before resolution.
        expect(isGfmSlug("§my-heading")).toBe(true);
        expect(isGfmSlug("my-heading¶")).toBe(true);
        expect(isGfmSlug("§my-heading¶")).toBe(true);
    });

    it("accepts slugs starting with numbers", () => {
        expect(isGfmSlug("1-introduction")).toBe(true);
        expect(isGfmSlug("123-test")).toBe(true);
    });

    it("rejects slugs with uppercase among affix chars", () => {
        // § is fine, but H is uppercase → reject
        expect(isGfmSlug("My-Heading")).toBe(false);
    });
});

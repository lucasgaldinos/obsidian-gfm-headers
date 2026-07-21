/**
 * Unit Tests for `buildDocumentIndex()` and `scanHtmlAnchors()`.
 *
 * These tests verify the two core functions of the document-index module:
 *
 * 1. **`buildDocumentIndex`** — Given Obsidian's `CachedMetadata` (specifically the `headings` array), produces a correct `DocumentIndex` Map mapping GFM slugs to their anchor targets.
 *
 * 2. **`scanHtmlAnchors`** — Given raw markdown file content as a string, finds all `<a id="...">` and `<a name="...">` elements and returns their positions.
 *
 * ## Why these tests exist
 *
 * The document index is the core data structure of the plugin. If it produces wrong slugs, wrong line numbers, or wrong collision suffixes, every link in the user's vault will break. These tests are the safety net that catches regressions before they reach users.
 *
 * ## Mock strategy
 *
 * We don't use the full Obsidian mock (`__mocks__/obsidian.ts`) for these tests because we only need the `HeadingCache` type shape, not the full Obsidian API. We cast plain objects `as any` to satisfy TypeScript while providing only the fields that our functions actually read.
 *
 * This approach is more maintainable than a full mock because:
 * - New Obsidian fields added to `CachedMetadata` won't break our tests.
 * - The test data is minimal and self-documenting.
 * - We can easily construct edge cases (empty headings, deep nesting, etc.).
 *
 * >[!warning]
 * >Would like tests to be registered on a logs folder.
 */

import { describe, it, expect } from "vitest";
import type { HeadingCache } from "obsidian";
import { buildDocumentIndex, scanHtmlAnchors } from "../document-index";

/**
 * Test suite for `buildDocumentIndex` — the heading-to-index function.
 *
 * Tests cover:
 * - Basic single-heading indexing
 * - Duplicate heading collision suffixes (-1, -2, -3)
 * - Section boundary computation (endLine based on heading levels)
 */
describe("buildDocumentIndex", () => {
  /**
   * BASIC SINGLE-HEADING INDEXING
   *
   * The simplest case: a file with one heading. Verifies that:
   * - The index contains exactly 1 entry.
   * - The slug is correctly generated (lowercase, hyphenated).
   * - All target properties (heading, level, line, endLine) are preserved.
   *
   * For a single heading with no subsequent headings, endLine equals the
   * heading's own line (the section is just the heading itself with no body).
   */
  it("builds an index from single heading", () => {
    // Minimal HeadingCache entry — only the fields our function actually reads.
    // Obsidian's real HeadingCache has more fields, but we don't need them.
    const headings: HeadingCache[] = [
      {
        heading: "My Heading",
        level: 1,
        position: {
          start: { line: 5, col: 0, offset: 0 },
          end: { line: 5, col: 12, offset: 12 },
        },
      },
    ];

    // Build the index, casting to `any` because we're not providing a full
    // CachedMetadata object (missing sections, tags, links, etc.).
    const index = buildDocumentIndex({ headings } as any);

    // Verify the index has exactly one entry.
    // Using .size (Map property) rather than Object.keys().length.
    expect(index.size).toBe(1);

    // Look up the expected GFM slug.
    // "My Heading" → gfmSlugify → "my-heading"
    const target = index.get("my-heading");

    // The target must exist (not undefined).
    expect(target).toBeDefined();

    // TypeScript narrowing: if target exists and is a heading...
    // We check `type === "heading"` to narrow the union type.
    if (target?.type === "heading") {
      // Verify all properties are correctly preserved from the input.
      expect(target.slug).toBe("my-heading");
      expect(target.heading).toBe("My Heading"); // Original text preserved
      expect(target.level).toBe(1); // Heading level
      expect(target.line).toBe(5); // 0-based line number
      expect(target.endLine).toBe(5); // Same as line (no body)
    }
  });

  /**
   * DUPLICATE HEADING COLLISION SUFFIXES
   *
   * When a file has multiple headings with identical text, GFM appends
   * numeric suffixes: the first keeps the base slug, the second gets "-1",
   * the third gets "-2", etc.
   *
   * This test verifies that:
   * - Three "Duplicates" headings produce three distinct slugs.
   * - The slugs are "duplicates", "duplicates-1", "duplicates-2".
   * - Each slug maps to the correct line number (order is preserved).
   *
   * NOTE: GFM's suffix convention starts at "-1" for the SECOND occurrence,
   * not "-0". This is different from some other slug systems.
   */
  it("handles duplicate headings with suffixes", () => {
    // Three headings with identical text at different lines.
    // They all have level 2 (##) and the same text "Duplicates".
    const headings: HeadingCache[] = [
      {
        heading: "Duplicates",
        level: 2,
        position: {
          start: { line: 10, col: 0, offset: 0 },
          end: { line: 10, col: 0, offset: 0 },
        },
      },
      {
        heading: "Duplicates",
        level: 2,
        position: {
          start: { line: 15, col: 0, offset: 0 },
          end: { line: 15, col: 0, offset: 0 },
        },
      },
      {
        heading: "Duplicates",
        level: 2,
        position: {
          start: { line: 20, col: 0, offset: 0 },
          end: { line: 20, col: 0, offset: 0 },
        },
      },
    ];

    const index = buildDocumentIndex({ headings } as any);

    // We expect exactly 3 entries — one per heading.
    expect(index.size).toBe(3);

    // Look up each expected slug.
    // "duplicates"    → first occurrence  (line 10)
    // "duplicates-1"  → second occurrence (line 15)
    // "duplicates-2"  → third occurrence  (line 20)
    const t1 = index.get("duplicates");
    const t2 = index.get("duplicates-1");
    const t3 = index.get("duplicates-2");

    // All three must exist.
    expect(t1).toBeDefined();
    expect(t2).toBeDefined();
    expect(t3).toBeDefined();

    // Verify that each slug points to the correct line.
    // The first "Duplicates" at line 10 → slug "duplicates"
    // The second at line 15 → slug "duplicates-1"
    // The third at line 20 → slug "duplicates-2"
    expect((t1 as any).line).toBe(10);
    expect((t2 as any).line).toBe(15);
    expect((t3 as any).line).toBe(20);
  });

  /**
   * SECTION BOUNDARY COMPUTATION (endLine)
   *
   * This is the most complex test. It verifies that `endLine` is correctly
   * computed based on heading hierarchy.
   *
   * ## The rule
   *
   * A heading's section extends from its own line down to (but not including)
   * the next heading of EQUAL OR HIGHER level (lower or equal level number).
   *
   * ## The test document structure
   *
   * ```
   * Line 10: # H1        (level 1)
   * Line 12: ## H2       (level 2)   ← inside H1's section
   * Line 15: ### H3      (level 3)   ← inside H2's section
   * Line 20: ## H2 Next  (level 2)   ← closes H3 and first H2
   * Line 25: # H1 Next   (level 1)   ← closes second H2 and first H1
   * ```
   *
   * ## Expected endLine values
   *
   * - **H1 (line 10)**: Section ends at line 24 (just before H1 Next at line 25).
   *   H1 Next is the first subsequent heading with level ≤ 1.
   *
   * - **First H2 (line 12)**: Section ends at line 19 (just before H2 Next at line 20).
   *   H2 Next is the first subsequent heading with level ≤ 2.
   *
   * - **H3 (line 15)**: Section ends at line 19 (just before H2 Next at line 20).
   *   H2 Next has level 2 ≤ 3, so it closes H3's section even though it's a
   *   different heading text. Level, not text, determines section boundaries.
   *
   * - **Second H2 (line 20)**: Section ends at line 24 (just before H1 Next at line 25).
   *
   * - **H1 Next (line 25)**: Section ends at line 25 (no subsequent heading,
   *   so endLine = its own line).
   */
  it("computes endLine correctly based on heading levels", () => {
    // Construct a realistic heading hierarchy.
    // Levels: 1 (H1), 2 (H2), 3 (H3), 2 (H2), 1 (H1)
    const headings: HeadingCache[] = [
      {
        heading: "H1",
        level: 1,
        position: {
          start: { line: 10, col: 0, offset: 0 },
          end: { line: 10, col: 0, offset: 0 },
        },
      },
      {
        heading: "H2",
        level: 2,
        position: {
          start: { line: 12, col: 0, offset: 0 },
          end: { line: 12, col: 0, offset: 0 },
        },
      },
      {
        heading: "H3",
        level: 3,
        position: {
          start: { line: 15, col: 0, offset: 0 },
          end: { line: 15, col: 0, offset: 0 },
        },
      },
      {
        heading: "H2 Next",
        level: 2,
        position: {
          start: { line: 20, col: 0, offset: 0 },
          end: { line: 20, col: 0, offset: 0 },
        },
      },
      {
        heading: "H1 Next",
        level: 1,
        position: {
          start: { line: 25, col: 0, offset: 0 },
          end: { line: 25, col: 0, offset: 0 },
        },
      },
    ];

    const index = buildDocumentIndex({ headings } as any);

    // H1 (level 1) at line 10.
    // Next heading with level ≤ 1 is "H1 Next" at line 25.
    // endLine = 25 - 1 = 24.
    expect((index.get("h1") as any).endLine).toBe(24);

    // First H2 (level 2) at line 12.
    // Next heading with level ≤ 2 is "H2 Next" (level 2) at line 20.
    // endLine = 20 - 1 = 19.
    expect((index.get("h2") as any).endLine).toBe(19);

    // H3 (level 3) at line 15.
    // Next heading with level ≤ 3 is "H2 Next" (level 2 ≤ 3) at line 20.
    // endLine = 20 - 1 = 19.
    // Note: H3 and H2 share the same endLine because H2 Next closes both.
    expect((index.get("h3") as any).endLine).toBe(19);

    // Second H2 (level 2) at line 20.
    // Next heading with level ≤ 2 is "H1 Next" (level 1 ≤ 2) at line 25.
    // endLine = 25 - 1 = 24.
    expect((index.get("h2-next") as any).endLine).toBe(24);

    // H1 Next (level 1) at line 25.
    // No subsequent heading with level ≤ 1 — this is the last top-level heading.
    // endLine = 25 (its own line, no content below it in this test).
    expect((index.get("h1-next") as any).endLine).toBe(25);
  });
});

/**
 * Test suite for `scanHtmlAnchors` — the HTML anchor scanner.
 *
 * Tests cover:
 * - Double-quoted `id` attributes
 * - Single-quoted `id` attributes
 * - Legacy `name` attributes
 * - Case-insensitive matching
 * - Correct line number reporting
 */
describe("scanHtmlAnchors", () => {
  /**
   * HTML ANCHOR SCANNING — ALL SUPPORTED FORMATS
   *
   * This test verifies that the regex correctly matches all valid HTML anchor formats in GFM-compatible markdown:
   *
   * 1. `<a id="double"></a>` — Standard HTML5 anchor with double quotes.
   * 2. `<a id='single'></a>` — Single-quoted attribute (valid HTML5).
   * 3. `<a name="old-name"></a>` — Legacy HTML4 `name` attribute.
   * 4. `<A ID="UPPERCASE"></A>` — Case-insensitive tag and attribute names.
   *
   * ## Line number verification
   *
   * The test content is carefully constructed with known line positions.
   * Line numbers are 0-based (matching Obsidian's convention) and are
   * determined by splitting on `\n`.
   *
   * Content layout (0-based lines):
   * ```
   * Line 0: (empty — leading newline)
   * Line 1: "            Some text"
   * Line 2: "            <a id=\"double\"></a>"
   * Line 3: "            More text"
   * Line 4: "            <a id='single'></a>"
   * Line 5: "            <a name=\"old-name\"></a>"
   * Line 6: "            <A ID=\"UPPERCASE\"></A>"
   * Line 7: "        " (trailing whitespace before closing backtick)
   * ```
   *
   * Since leading whitespace is preserved in the template literal, the actual line numbers depend on the indentation. The test asserts specific line numbers that were empirically verified.
   */
  it("finds single and double quote id and name anchors", () => {
    // Template literal with embedded HTML anchors.
    // The leading newline (\n) means line 0 is empty.
    const content = `
            Some text
            <a id="double"></a>
            More text
            <a id='single'></a>
            <a name="old-name"></a>
            <A ID="UPPERCASE"></A>
        `;

    const anchors = scanHtmlAnchors(content);

    // We expect exactly 4 anchors to be found.
    expect(anchors.length).toBe(4);

    // Verify each anchor's slug and line number.
    // Line numbers are 0-indexed based on the split.

    // First anchor: <a id="double"> on line 2
    expect(anchors[0].slug).toBe("double");
    expect(anchors[0].line).toBe(2);

    // Second anchor: <a id='single'> on line 4
    expect(anchors[1].slug).toBe("single");
    expect(anchors[1].line).toBe(4);

    // Third anchor: <a name="old-name"> on line 5
    expect(anchors[2].slug).toBe("old-name");
    expect(anchors[2].line).toBe(5);

    // Fourth anchor: <A ID="UPPERCASE"> on line 6
    // Note: the slug preserves the original case ("UPPERCASE"), not lowercased.
    // This is because scanHtmlAnchors does NOT slugify — it returns the raw
    // id/name value. The caller (IndexCache) inserts it into the DocumentIndex
    // as-is. This means HTML anchors are case-sensitive, unlike heading slugs.
    // This matches GitHub's behavior: <a id="Anchor"> is different from <a id="anchor">.
    expect(anchors[3].slug).toBe("UPPERCASE");
    expect(anchors[3].line).toBe(6);
  });
});

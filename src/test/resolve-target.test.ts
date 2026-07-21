/**
 * Unit Tests for `resolveGfmTarget()` — the GFM Link Resolution Function.
 *
 * These tests verify the central resolution logic that determines whether
 * a link should be handled as GFM or passed through to Obsidian's native
 * handler.
 *
 * ## Test architecture
 *
 * Because `resolveGfmTarget` depends on the Obsidian API (`vault`, `metadataCache`,
 * `TFile`) and our own `IndexCache`, we must mock all these dependencies.
 *
 * The mock strategy:
 * - **`mockPlugin`**: A minimal object matching the `GfmHeadingLinksPlugin` interface.
 *   All methods are `vi.fn()` stubs that return controlled values per test case.
 * - **`vi.mocked()`**: Type-safe wrapper around Vitest's mock functions that
 *   preserves TypeScript types while allowing `.mockReturnValueOnce()` calls.
 * - **No file system**: We don't read actual files. The mock returns pre-built
 *   `DocumentIndex` Maps and `TFile` instances.
 *
 * ## What these tests DON'T cover
 *
 * - Actual file I/O (mocked out)
 * - Obsidian's link resolution algorithm (we mock `getFirstLinkpathDest`)
 * - The `IndexCache` internals (we mock `indexCache.get`)
 * - Real heading data from parsed markdown (we provide synthetic Maps)
 *
 * These are true UNIT tests — they test `resolveGfmTarget` in isolation.
 * Integration tests (in a real Obsidian vault) would be needed to verify
 * end-to-end behavior, but that's outside the scope of unit testing.
 */

import { describe, it, expect, vi } from "vitest";
import { resolveGfmTarget, type GfmHeadingLinksPlugin } from "../resolve-target";
import type { IndexCache } from "../index-cache";
import type { DocumentIndex, AnchorTarget } from "../link-target";
import { TFile } from "obsidian";

/**
 * Test suite for `resolveGfmTarget`.
 *
 * Each test constructs a specific scenario (same-file link, cross-file link,
 * non-GFM link, broken link, etc.) and verifies the correct `ResolutionResult`
 * is returned.
 */
describe("resolveGfmTarget", () => {
    /**
     * MOCK PLUGIN INSTANCE
     *
     * We create ONE mock plugin for the entire test suite. Individual tests
     * use `vi.mocked()` to configure specific return values for specific
     * test cases. Mock state is NOT reset between tests by default (we rely
     * on `mockReturnValueOnce` to ensure each test gets its own configuration).
     *
     * Mock structure:
     * ```
     * mockPlugin
     * ├── app
     * │   ├── vault
     * │   │   └── getAbstractFileByPath: vi.fn()   — for same-file link resolution
     * │   └── metadataCache
     * │       └── getFirstLinkpathDest: vi.fn()     — for cross-file link resolution
     * └── indexCache
     *     └── get: vi.fn()                           — for document index lookup
     * ```
     *
     * Each mock function is a Vitest mock (`vi.fn()`) that returns `undefined`
     * by default. Tests call `mockReturnValueOnce()` or `mockResolvedValueOnce()`
     * to set specific return values for their scenario.
     *
     * >[!warning]
     * >I don't know mock tests. Would like to learn more about it and how this mocking part work.
     */
    const mockPlugin = {
        app: {
            vault: {
                getAbstractFileByPath: vi.fn()
            },
            metadataCache: {
                getFirstLinkpathDest: vi.fn()
            }
        },
        indexCache: {
            get: vi.fn()
        } as unknown as IndexCache
    } as unknown as GfmHeadingLinksPlugin;

    /**
     * NON-GFM LINK DETECTION (PASSTHROUGH)
     *
     * The resolution function must correctly identify links that are NOT GFM-formatted and return `{ type: "passthrough" }` so Obsidian's native handler can process them.
     *
     * This test verifies all five guard conditions:
     *
     * 1. **Uppercase in slug** — `"My-Heading"` has uppercase 'M' and 'H'. Obsidian preserves case, so uppercase = Obsidian format.
     *
     * 2. **URL encoding** — `"my%20heading"` contains `%20` (encoded space). GFM slugs should never need URL encoding since they only contain lowercase letters, numbers, hyphens, and underscores.
     *
     * 3. **Block reference** — `"^block-id"` starts with `^`, which is Obsidian's syntax for referencing a block (paragraph, list item, etc.). Never a GFM heading slug.
     *
     * 4. **Footnote reference** — `"[^footnote]"` starts with `[^`, which is markdown's footnote syntax. Never a GFM slug.
     *
     * 5. **Empty slug** — `""` means the link has no fragment at all (e.g., `[[Note]]` without `#`). Passthrough.
     *
     * All five should return `{ type: "passthrough" }` without calling any vault or cache methods (the guard runs first).
     */
    it("passes through native links (uppercase, encoded, block refs)", async () => {
        // Each of these should be detected as non-GFM and passed through.
        expect(await resolveGfmTarget(mockPlugin, "Note.md", "My-Heading", "")).toEqual({ type: "passthrough" });
        expect(await resolveGfmTarget(mockPlugin, "Note.md", "my%20heading", "")).toEqual({ type: "passthrough" });
        expect(await resolveGfmTarget(mockPlugin, "Note.md", "^block-id", "")).toEqual({ type: "passthrough" });
        expect(await resolveGfmTarget(mockPlugin, "Note.md", "[^footnote]", "")).toEqual({ type: "passthrough" });
        expect(await resolveGfmTarget(mockPlugin, "Note.md", "", "")).toEqual({ type: "passthrough" });
    });

    /**
     * FILE-NOT-FOUND SCENARIO
     *
     * When the note path points to a file that doesn't exist in the vault, the resolution should return `{ type: "file-not-found" }` so the caller can show Obsidian's native "file not found" behavior (which typically offers to create the note).
     *
     * We configure the mock to return `null` from `getFirstLinkpathDest`, simulating a non-existent file.
     */
    it("returns file-not-found when target file does not exist", async () => {
        // Simulate: Obsidian can't find "NonExistent.md" when resolving from "Source.md".
        vi.mocked(mockPlugin.app.metadataCache.getFirstLinkpathDest).mockReturnValueOnce(null);

        const result = await resolveGfmTarget(mockPlugin, "NonExistent.md", "some-heading", "Source.md");

        // Expect file-not-found with no target or file.
        expect(result).toEqual({ type: "file-not-found" });
    });

    /**
     * SAME-FILE LINK RESOLUTION (SUCCESS)
     *
     * When the note path is empty (`""`), the link targets a heading in the
     * SAME file. The file is resolved from `sourcePath` using
     * `vault.getAbstractFileByPath`.
     *
     * This test:
     * 1. Mocks `getAbstractFileByPath` to return a `TFile` instance (the source file).
     * 2. Mocks `indexCache.get` to return a pre-built DocumentIndex containing
     *    the expected slug → target mapping.
     * 3. Calls `resolveGfmTarget` with an empty notePath.
     * 4. Verifies the result is `{ type: "success" }` with the correct file and target.
     */
    it("resolves same-file links", async () => {
        // Create a mock TFile representing the source file.
        const file = new TFile();

        // Configure mock: when asked for sourcePath, return our mock file.
        vi.mocked(mockPlugin.app.vault.getAbstractFileByPath).mockReturnValueOnce(file);

        // Build a synthetic DocumentIndex containing one heading target.
        const mockIndex: DocumentIndex = new Map();
        const target: AnchorTarget = {
            type: "heading",
            slug: "test",
            heading: "Test",
            level: 1,
            line: 10,
            endLine: 20
        };
        mockIndex.set("test", target);

        // Configure mock: when asked for the file's index, return our synthetic index.
        vi.mocked(mockPlugin.indexCache.get).mockResolvedValueOnce(mockIndex);

        // Resolve a same-file link (notePath = "").
        const result = await resolveGfmTarget(mockPlugin, "", "test", "Source.md");

        // Expect success with the correct file and target.
        expect(result).toEqual({ type: "success", file, target });
    });

    /**
     * PASSTHROUGH WHEN SLUG NOT IN INDEX
     *
     * If the file exists and the slug looks like GFM (passes the guard),
     * but the slug is NOT found in the document index, we return
     * `{ type: "passthrough", file }` — Obsidian will at least open
     * the correct file, even if it can't find a matching heading.
     *
     * This scenario occurs when:
     * - A GFM-style link points to a heading that doesn't exist (typo).
     * - The file hasn't been indexed yet (unlikely with lazy loading, but possible).
     * - The heading was deleted after the link was written.
     */
    it("falls back to passthrough if slug not found in index", async () => {
        // Create a mock TFile — the file EXISTS, but the slug isn't in its index.
        const file = new TFile();

        // Configure mock: file is found.
        vi.mocked(mockPlugin.app.metadataCache.getFirstLinkpathDest).mockReturnValueOnce(file);

        // Configure mock: the index is empty (no matching slug).
        vi.mocked(mockPlugin.indexCache.get).mockResolvedValueOnce(new Map());

        const result = await resolveGfmTarget(mockPlugin, "Target.md", "unknown-slug", "Source.md");

        // Expect passthrough WITH the file (so Obsidian can at least open the file).
        expect(result).toEqual({ type: "passthrough", file });
    });
});

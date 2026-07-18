---
title: "Objectives & Architecture Decisions"
tags: [architecture, plan, objectives, decisions]
description: "Why we're building the GFM Heading Links plugin this way — 8 objectives, v1 scope table, and 7 architecture decisions with rationale."
date_created: 2026-07-08
date_changed: 2026-07-17
author: ["Lucas Galdino", "GitHub Copilot"]
plan_version: "2.0"
parent: "[[plan.md]]"
---

# Objectives & Architecture Decisions

> Extracted from [`plan.md`](./plan.md) — refer to [`design.md`](design.md) for internal workflows, [`tasks.md`](tasks.md) for implementation steps, [`validation.md`](validation/validation.md) for the test matrix, and [`files.md`](files.md) for expected file changes and risks.

## Objectives

- **OBJ-001:** Replace the speculative duplicate-heading strategy (`#Commands#Commands`) with a deterministic Line-Number Index mapping. We will map GFM slugs directly to file line numbers, bypassing Obsidian's buggy native duplicate subpath resolution. → [TASK-0103](tasks.md#task-0103-build-document-index-in-srcdocument-indexts) + [TASK-0105](tasks.md#task-0105-implement-resolvegfmtarget-in-srcresolve-targetts).
- **OBJ-002:** Preserve native Obsidian behaviors for modifier-key navigation, Page Preview hover, Reading view, Live Preview, Source mode, mobile, and cross-file links. → Verified by [validation matrix](validation/validation.md#manual-validation-matrix).
- **OBJ-003:** Use a **Unified Architecture** that combines complementary interception points: `openLinkText` for click routing, `EditorSuggest.selectSuggestion` for autocomplete output (mutating `value.subpath` before native insertion), `trigger('hover-link')` for Page Preview, and Virtual Block Injection for native flashing and scrolling. → See [5-layer architecture](design.md#recommended-unified-architecture) and [Phase 4 tasks](tasks.md#phase-4-navigation-monkeypatches).
- **OBJ-004:** Support GitHub Flavored Markdown heading slug semantics: lowercase conversion, Unicode letter preservation, underscore preservation, punctuation stripping, empty-heading behavior, and collision-safe duplicate suffixes. → Tested by [TASK-0202](tasks.md#task-0202-test-gfmslugify) + [TASK-0203](tasks.md#task-0203-test-collision-safe-slug-allocation).
- **OBJ-005:** Support HTML anchors (`<a id="custom-anchor"></a>`) by indexing them during file reads (target identification only in v1). DOM click interception for HTML anchors is deferred to v2. → [TASK-0104](tasks.md#task-0104-html-anchor-scanning-in-srcdocument-indexts).
- **OBJ-006:** Adhere to **SOLID principles**:
  + *Single Responsibility:* Separate link parsing, document indexing, and UI navigation into isolated modules.
  + *Open/Closed:* Allow new link types (like HTML anchors) to be added without modifying the core router.
  + *Dependency Inversion:* Navigation adapters depend on abstractions (`AnchorTarget`), not concrete implementations.
- **OBJ-007:** Intercept link creation by patching `app.workspace.editorSuggest`. When Obsidian auto-completes or generates a link to a heading, we will automatically output the GFM format (e.g., `[Heading Text](#heading-slug)`) instead of the native format, matching the tactic used by `obsidian-better-markdown-links`. → Implemented by [TASK-0404](tasks.md#task-0404-implement-generatemarkdownlink--editorsuggest-monkeypatch).
- **OBJ-008:** Add observable debug logging so development builds expose how links are parsed, resolved, and navigated. → See [debug event reference](validation/validation.md#debug-logging-event-reference), [TASK-0501](tasks.md#task-0501-implement-srcdebugts), and expected traces in [validation.md](validation/validation.md#expected-console-trace--successful-gfm-click).

## Scope: v1 vs deferred

| Feature | v1 | Reason if deferred |
|---|---|---|
| Click navigation (GFM slug → line number → applyScroll) | ✅ | Core fix |
| Page Preview hover (hover-link trigger patch) | ✅ | Already working, keep + refine |
| Auto-complete GFM output (EditorSuggest.selectSuggestion patch) | ✅ | Mutates `value.subpath` before native insertion; resolved alias loss + duplicate suffix bugs |
| Embed sections (`![[Note#gfm-slug]]`) | Defer to v2 | Currently working with native headings; GFM embeds use resolveSubpath internally which is complex |
| Link resolution coloring (dimmed links) | Defer to v2 | Cosmetic; currently working with native links |
| HTML anchor click handling (DOM interception) | Defer to v2 | Target identification via raw-file scanning in v1; click ownership requires multi-layer architecture changes. |
| Wikilink-aware editor suggestions | v1.3 | Auto-inject `\|Original Heading` alias when wikilinks enabled. See [OBJ-009](#v13-objectives--settings--wikilink-alias). |
| User-customizable link prefix/suffix | v1.3 | Settings tab for prefix/suffix characters (e.g., `¶`, `§`) on generated links. See [OBJ-010](#v13-objectives--settings--wikilink-alias). |

## v1.3 Objectives — Settings & Wikilink Alias

> Previously deferred to v2, now prioritized for v1.3. Easier to implement and more user-visible than HTML anchor support.

- **OBJ-009:** ~~Wikilink-aware editor suggestions.~~ **RESOLVED** — [TASK-1001](tasks.md#task-1001-wikilink-aware-editor-suggestions-done). After Obsidian inserts the link, the plugin appends `|Original Heading` via `editor.replaceRange` on the active editor. Controlled by `plugin.settings.enableWikilinkAlias` toggle. Output: `[[file#gfm-slug|Original Heading]]`.
- **OBJ-010:** ~~User-customizable prefix/suffix for link generation.~~ **RESOLVED** — [TASK-1002](tasks.md#task-1002-user-customizable-link-affixes-done) + [TASK-1003](tasks.md#task-1003-plugin-settings-tab-done). Settings tab with prefix/suffix fields + wikilink alias toggle. Affixes applied to heading alias during autocomplete (not the slug), so no stripping is needed during resolution.

## v1.3 Code Quality Objectives — Refactoring from Code Review

> Discovered during comprehensive code review (2026-07-16). These address DRY violations, SOLID principle gaps, and architectural consistency issues. All block the v1.3 release.

- **OBJ-011:** ~~Extract~~ `isGfmSlug()` as a single shared guard function in `gfm-slugify.ts`. **RESOLVED** — [TASK-1004](tasks.md#task-1004-extract-isgfmslug-shared-guard-function-done). Guard duplication eliminated; also fixed an inverted-condition bug discovered during extraction.
- **OBJ-012:** ~~Unify the hover-link resolution path with the main resolution pipeline.~~ **RESOLVED** — [TASK-1005](tasks.md#task-1005-unify-hover-link-resolution-with-indexcache-done). `resolveGfmTargetSync()` added to `resolve-target.ts`, hover handler now calls it instead of inline resolution. `require("./document-index")` removed.
- **OBJ-013:** ~~Extract shared virtual block injection into a single utility function.~~ **RESOLVED** — [TASK-1006](tasks.md#task-1006-extract-shared-virtual-block-injection-utility-done). `src/virtual-block.ts` created with `injectVirtualBlock()` and `VIRTUAL_BLOCK_CLEANUP_MS = 1500` constant.
- **OBJ-014:** ~~Split `patch-workspace.ts` by Single Responsibility Principle.~~ **RESOLVED** — [TASK-1007](tasks.md#task-1007-split-patch-workspacets-by-responsibility-done). Replaced by `patch-link-click.ts` (click navigation) + `patch-link-hover.ts` (hover preview). `patch-workspace.ts` deleted.
- **OBJ-015:** ~~Rename weak variable names for readability.~~ **RESOLVED** — [TASK-1008](tasks.md#task-1008-rename-weak-variable-names-done). `data` → `hoverEventPayload`, `value` → `suggestionValue`, `mutated` → `didModifySubpath`. `link-target.ts` renamed to `types.ts` with all 5 imports updated.
- **OBJ-016:** ~~Replace O(n²) section boundary algorithm with O(n) stack-based traversal.~~ **RESOLVED** — [TASK-1009](tasks.md#task-1009-stack-based-on-section-boundary-algorithm-done). Replaced nested loop in `buildDocumentIndex` with 2-pass approach: stack-based O(n) boundary computation, then O(n) target construction. All 25 existing tests pass unchanged.

## v1.3 Code Quality Objectives — Second Review Pass

> Discovered during second-pass code review (2026-07-16). These address god-function anti-patterns, separation-of-concerns violations, code duplication, and API migration debt. All block the v1.3 release.

- **OBJ-017:** ~~Extract `selectSuggestion` mutation pipeline.~~ **RESOLVED** — [TASK-1010](tasks.md#task-1010-extract-selectsuggestion-mutation-pipeline-done). Extracted `transformSuggestion()` pure 4-step pipeline (HTML strip → slug resolve → wikilink alias → affix apply). Each step is independently testable.
- **OBJ-018:** ~~Move link normalization to `src/link-parse.ts`.~~ **RESOLVED** — [TASK-1011](tasks.md#task-1011-create-link-normalization-layer-in-srclink-parsets-done). Created `normalizeSlug()` in `src/link-parse.ts`. Affixes are now on the alias (not slug), so no stripping is needed during resolution. `stripAffixes()` removed from the resolution pipeline.
- **OBJ-019:** ~~Eliminate sync/async resolution duplication.~~ **RESOLVED** — [TASK-1012](tasks.md#task-1012-eliminate-syncasync-resolution-pipeline-duplication-done). Extracted `decodeGfmSlug()` and `resolveTargetFile()` shared helpers. Both `resolveGfmTarget()` and `resolveGfmTargetSync()` reduced from ~90 to ~15 lines each.
- **OBJ-020:** ~~Migrate settings to declarative API.~~ **RESOLVED** — [TASK-1013](tasks.md#task-1013-migrate-settings-tab-to-declarative-getsettingdefinitions-api-done). Dual support: `getSettingDefinitions()` (Obsidian 1.13.0+) + `display()` fallback (< 1.13.0). `minAppVersion` set to `1.12.7`.

## v2 Objectives (Deferred)

- **HTML Anchor Support:** Click navigation in all modes, hover preview for HTML anchors. Currently only works in Reading mode. See Bugs [1](task-bugs.md#1-html-anchor-hover-inconsistency--deferred-to-v2) and [5](task-bugs.md#5-html-anchor-click-only-works-in-reading-mode--deferred-to-v2), and tasks [TASK-0802](tasks.md#task-0802-toggle-setting-for-html-anchors-deferred--v2), [TASK-0803](tasks.md#task-0803-investigate--fix-html-anchor-click-in-sourcelive-preview-deferred--v2).

## Architecture decisions

| Decision | Choice | Rationale |
|---|---|---|
| Cache strategy | Separate `DocumentIndex` (`Map<string, HeadingAnchorTarget>`) | Zero risk of side effects on Obsidian's native cache consumers (Outline, Graph, Backlinks, Search, autocomplete, other plugins). Manual invalidation on vault events. |
| DocumentIndex entry shape | `{ slug, heading, level, line, endLine }` | Line numbers (0-based, from `Loc` interface). `endLine` preserves Obsidian's heading-span behavior. `level` enables correct span computation. |
| Guard logic | No uppercase + no `%XX` URL encoding = GFM slug. Block refs (`#^`) and footnotes (`#[^`) explicitly detected and passed through. | Proven sufficient by current implementation. Covers GFM spec (lowercase, no URL encoding) vs OFM (exact-case, URL-encoded for special chars). |
| Same-file navigation | Approach A: always call `openLinkText` even for same-file links (one code path) | Preserves modifier keys (Ctrl+click → new tab). Obsidian's `openFile` on same file with no subpath is a near-instant no-op. If flicker is observed during validation, add Approach B (skip `openLinkText`, just `applyScroll`) as optimization. |
| Cross-file view finding | Post-await loop: check active view first, then match by file path | Handles new tabs, splits, and same-pane uniformly. If timing issues arise in v2, add polling fallback. |
| `applyScroll` type safety | Local `PreviewRendererLike` interface with runtime cast | The `applyScroll(line, {highlight: true})` overload is confirmed from decompiled Obsidian `app.js` but not declared in `obsidian.d.ts`. Wrapping in a local interface avoids `any` casts scattered throughout the codebase. |
| Hover-link strategy | Virtual Block Injection (inject temp block to `cache.blocks`, rewrite link to `#^virtualId`) | By injecting a synthetic block mapped to the exact line numbers retrieved from our `DocumentIndex`, Obsidian's native preview renderer resolves exactly the correct duplicate section. Cleaned up after 1500ms to avoid cache pollution. |

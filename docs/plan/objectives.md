---
title: "Objectives & Architecture Decisions"
tags: [architecture, plan, objectives, decisions]
description: "Why we're building the GFM Heading Links plugin this way — 8 objectives, v1 scope table, and 7 architecture decisions with rationale."
date_created: 2026-07-08
date_changed: 2026-07-10
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
| HTML anchor click handling (DOM interception) | Defer to v2 | Target identification via raw-file scanning in v1; click ownership via DOM interception in v2 |
| Wikilink-aware editor suggestions | Defer to v2 | Auto-inject `\|Original Heading` alias when wikilinks enabled. See [OBJ-009](#v2-objectives-deferred). |
| User-customizable link prefix/suffix | Defer to v2 | Allow users to add characters (e.g., `¶`, `§`) to generated links. See [OBJ-010](#v2-objectives-deferred). |

## v2 Objectives (Deferred)

- **OBJ-009:** Wikilink-aware editor suggestions. When the user's Obsidian settings have "Use Markdown links" disabled (wikilinks enabled), autocomplete should output `[[file#gfm-slug|Original Heading]]` instead of just `[[file#gfm-slug]]`. Currently the alias is only preserved for markdown link format, not wikilinks. → See [TASK-1001](tasks.md#task-1001-wikilink-aware-editor-suggestions-todo).
- **OBJ-010:** User-customizable prefix/suffix for link generation. Expose a settings tab allowing users to prepend/append characters to generated GFM links (e.g., `¶` pilcrow, `§` section sign). This would modify the `value.subpath` mutation in `applyEditorSuggestPatches` to include the user's chosen affixes. → See [TASK-1002](tasks.md#task-1002-user-customizable-link-affixes-todo).

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

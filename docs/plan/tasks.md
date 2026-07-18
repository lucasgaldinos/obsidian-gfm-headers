---
title: "Tasks: Implementation Plan"
tags: [architecture, plan, tasks, implementation]
description: "7 phases, 24 tasks with dependency graphs, parallel execution opportunities, and console-based verification steps using debugLog traces."
date_created: 2026-07-08
date_changed: 2026-07-16
author: ["Lucas Galdino", "GitHub Copilot"]
plan_version: "2.0"
parent: "[[plan.md]]"
---

# Tasks: Implementation Plan

> Extracted from [`plan.md`](./plan.md). See [`objectives.md`](objectives.md) for architecture decisions, [`design.md`](design.md) for internal workflows, [`validation.md`](validation/validation.md) for the test matrix, [`files.md`](files.md) for expected file changes, and [`task-bugs.md`](task-bugs.md) for a register of bugs found and fixed.

Each phase lists its tasks, dependencies, parallel opportunities, files to touch, and verification steps. Verification uses the `debugLog` utility (`DEBUG_ENABLED = true`) for runtime behavior and `npm test` for pure logic.

- [Tasks: Implementation Plan](#tasks-implementation-plan)
  + [Phase 1: Core Target Model and Document Index](#phase-1-core-target-model-and-document-index)
    - [TASK-0101: Create shared types in `src/link-target.ts` \[DONE\]](#task-0101-create-shared-types-in-srclink-targetts-done)
    - [TASK-0102: Clean up `src/gfm-slugify.ts` \[DONE\]](#task-0102-clean-up-srcgfm-slugifyts-done)
    - [TASK-0103: Build document index in `src/document-index.ts` \[DONE\]](#task-0103-build-document-index-in-srcdocument-indexts-done)
    - [TASK-0104: HTML anchor scanning in `src/document-index.ts` \[DONE\]](#task-0104-html-anchor-scanning-in-srcdocument-indexts-done)
    - [TASK-0105: Implement `resolveGfmTarget` in `src/resolve-target.ts` \[DONE\]](#task-0105-implement-resolvegfmtarget-in-srcresolve-targetts-done)
    - [TASK-0106: Implement `src/index-cache.ts` \[DONE\]](#task-0106-implement-srcindex-cachets-done)
  + [Phase 2: Automated Tests for Pure Logic](#phase-2-automated-tests-for-pure-logic)
    - [TASK-0201: Set up Vitest \[DONE\]](#task-0201-set-up-vitest-done)
    - [TASK-0202-0206: Test suites \[DONE\]](#task-0202-0206-test-suites-done)
  + [Phase 3: Reveal Target Logic](#phase-3-reveal-target-logic)
    - [TASK-0301: Implement `src/reveal-target.ts` \[DONE\]](#task-0301-implement-srcreveal-targetts-done)
  + [Phase 4: Navigation Monkeypatches](#phase-4-navigation-monkeypatches)
    - [TASK-0401: Update `openLinkText` interceptor \[DONE\]](#task-0401-update-openlinktext-interceptor-done)
    - [TASK-0402: Find the view after `openLinkText` \[DONE\]](#task-0402-find-the-view-after-openlinktext-done)
    - [TASK-0403: Update `trigger('hover-link')` interceptor \[DONE\]](#task-0403-update-triggerhover-link-interceptor-done)
      + [Original Approach (Implemented)](#original-approach-implemented)
      + [Updated Approach (Implemented)](#updated-approach-implemented)
    - [TASK-0404: Implement Autocomplete monkeypatch \[DONE\]](#task-0404-implement-autocomplete-monkeypatch-done)
      + [Original Plan: `generateMarkdownLink`](#original-plan-generatemarkdownlink)
      + [Updated Approach (Implemented): `EditorSuggest`](#updated-approach-implemented-editorsuggest)
    - [TASK-0405: Optimize `openLinkText` for Same-File Navigation \[DONE\]](#task-0405-optimize-openlinktext-for-same-file-navigation-done)
    - [TASK-0407: Fix EditorSuggest Alias \& Cache Latency \[DONE\]](#task-0407-fix-editorsuggest-alias--cache-latency-done)
  + [Phase 5: Debug Logging and Final Wiring](#phase-5-debug-logging-and-final-wiring)
    - [TASK-0501: Implement `src/debug.ts` \[DONE\]](#task-0501-implement-srcdebugts-done)
    - [TASK-0502: Wire everything in `main.ts` \[DONE\]](#task-0502-wire-everything-in-maints-done)
  + [Phase 6: Manual Validation](#phase-6-manual-validation)
    - [TASK-0601: Verify test vault at `/home/lucas_galdino/my_pc/projects/test_vault` \[DONE\]](#task-0601-verify-test-vault-at-homelucas_galdinomy_pcprojectstest_vault-done)
    - [TASK-0602: Execute validation matrix (see `validation.md`) \[DONE\]](#task-0602-execute-validation-matrix-see-validationmd-done)
    - [TASK-0603: Verify autocomplete behavior \[DONE\]](#task-0603-verify-autocomplete-behavior-done)
    - [TASK-0604: Verify debug logs trace full pipeline \[DONE\]](#task-0604-verify-debug-logs-trace-full-pipeline-done)
  + [Phase 7: Release Readiness](#phase-7-release-readiness)
    - [TASK-0701: `npm test` — all pass \[DONE\]](#task-0701-npm-test--all-pass-done)
    - [TASK-0702: `npm run build` — typescript + esbuild succeed \[DONE\]](#task-0702-npm-run-build--typescript--esbuild-succeed-done)
    - [TASK-0703: Update `README.md`, `CHANGELOG.md` \[DONE\]](#task-0703-update-readmemd-changelogmd-done)
    - [TASK-0704: Git review — intended files only \[DONE\]](#task-0704-git-review--intended-files-only-done)
    - [TASK-0705: Publish v1.2.0 Release \[DONE\]](#task-0705-publish-v120-release-done)
  + [Phase 8: Future Enhancements](#phase-8-future-enhancements)
    - [TASK-0801: Implement End-to-End (E2E) Test Suite \[TODO\]](#task-0801-implement-end-to-end-e2e-test-suite-todo)
    - [TASK-0804: Fix Cross-BaseSlug Collision in buildDocumentIndex \[DONE\]](#task-0804-fix-cross-baseslug-collision-in-builddocumentindex-done)
    - [TASK-0802: Toggle Setting for HTML Anchors \[DEFERRED — v2\]](#task-0802-toggle-setting-for-html-anchors-deferred--v2)
    - [TASK-0803: Investigate \& Fix HTML Anchor Click in Source/Live Preview \[DEFERRED — v2\]](#task-0803-investigate--fix-html-anchor-click-in-sourcelive-preview-deferred--v2)
  + [Phase 9: Dev Branch Cleanup \& Documentation](#phase-9-dev-branch-cleanup--documentation)
    - [TASK-0901: Replace console.log with debugLog \[DONE\]](#task-0901-replace-consolelog-with-debuglog-done)
    - [TASK-0902: Proper Debug System Design \[TODO\]](#task-0902-proper-debug-system-design-todo)
    - [TASK-0903: Create Logs Folder for Test Output \[TODO\]](#task-0903-create-logs-folder-for-test-output-todo)
    - [TASK-0904: Reveal-Target Validation Guide \[DONE\]](#task-0904-reveal-target-validation-guide-done)
    - [TASK-0905: Harder GFM Slug Test Cases \[DONE\]](#task-0905-harder-gfm-slug-test-cases-done)
    - [TASK-0906: Fix Unused HeadingCache Import \[DONE\]](#task-0906-fix-unused-headingcache-import-done)
    - [TASK-0907: Plan Documentation Refresh \[DONE\]](#task-0907-plan-documentation-refresh-done)
  + [Phase 10: v1.3 — Code Quality Refactoring + Settings \& Wikilink Alias](#phase-10-v13--code-quality-refactoring--settings--wikilink-alias)
    - [TASK-1004: Extract `isGfmSlug()` Shared Guard Function \[DONE\]](#task-1004-extract-isgfmslug-shared-guard-function-done)
    - [TASK-1005: Unify Hover-Link Resolution with IndexCache \[DONE\]](#task-1005-unify-hover-link-resolution-with-indexcache-done)
    - [TASK-1006: Extract Shared Virtual Block Injection Utility \[DONE\]](#task-1006-extract-shared-virtual-block-injection-utility-done)
    - [TASK-1007: Split `patch-workspace.ts` by Responsibility \[DONE\]](#task-1007-split-patch-workspacets-by-responsibility-done)
    - [TASK-1008: Rename Weak Variable Names \[DONE\]](#task-1008-rename-weak-variable-names-done)
    - [TASK-1009: Stack-Based O(n) Section Boundary Algorithm \[DONE\]](#task-1009-stack-based-on-section-boundary-algorithm-done)
    - [TASK-1003: Plugin Settings Tab \[DONE\]](#task-1003-plugin-settings-tab-done)
    - [TASK-1001: Wikilink-Aware Editor Suggestions \[DONE\]](#task-1001-wikilink-aware-editor-suggestions-done)
    - [TASK-1002: User-Customizable Link Affixes \[DONE\]](#task-1002-user-customizable-link-affixes-done)
  + [Phase 11: v2 — HTML Anchor Support (Deferred)](#phase-11-v2--html-anchor-support-deferred)
    - [TASK-0802: Toggle Setting for HTML Anchors \[DEFERRED — v2\]](#task-0802-toggle-setting-for-html-anchors-deferred--v2-1)
    - [TASK-0803: Investigate \& Fix HTML Anchor Click in Source/Live Preview \[DEFERRED — v2\]](#task-0803-investigate--fix-html-anchor-click-in-sourcelive-preview-deferred--v2-1)

---

## Phase 1: Core Target Model and Document Index

**Cycles: none.** Pure modules — no monkeypatching, no Obsidian runtime needed. These tasks implement [OBJ-001](objectives.md), [OBJ-004](objectives.md), [OBJ-005](objectives.md), and [OBJ-006](objectives.md).

```
TASK-0101 (types) ──→ TASK-0103 (index) ──→ TASK-0105 (resolve)
TASK-0102 (cleanup) ──→ (parallel with 0101)
TASK-0104 (anchors) ──→ (parallel with 0103)
TASK-0106 (cache) ────→ (parallel with 0105)
```

**Parallel opportunities:** 0101+0102 can start together. 0104 and 0106 are independent. 0103 blocks 0105.

### TASK-0101: Create shared types in `src/link-target.ts` [DONE]

**Depends on:** nothing. **Parallel with:** TASK-0102.

Define `HeadingAnchorTarget { slug, heading, level, line, endLine }`, `DocumentIndex = Map<string, HeadingAnchorTarget>`, `HtmlAnchorTarget`, `AnchorTarget`, `ResolutionResult`. See the [Scope table](objectives.md#scope-v1-vs-deferred) for what's in v1 vs v2 and the [Architecture decisions](objectives.md#architecture-decisions) for the entry shape rationale.

**Verification:** `npx tsc --noEmit` passes.

### TASK-0102: Clean up `src/gfm-slugify.ts` [DONE]

**Depends on:** nothing. **Parallel with:** TASK-0101.

Keep `gfmSlugify()`. Remove `resolveGfmSlug()`.

**Verification:** `npm run build` passes. No `resolveGfmSlug` references remain.

### TASK-0103: Build document index in `src/document-index.ts` [DONE]

**Depends on:** TASK-0101 + TASK-0102.

`buildDocumentIndex(headings: HeadingCache[]): DocumentIndex`. Walk headings, generate collision-safe GFM slugs with `usedSlugs: Set`, store entries, compute `endLine` in second pass.

**Verification (console test):**

```typescript
const cache = app.metadataCache.getFileCache(file);
const index = buildDocumentIndex(cache.headings);
console.log([...index.entries()].map(([slug, t]) => `${slug} → L${t.line}: "${t.heading}"`));
```

### TASK-0104: HTML anchor scanning in `src/document-index.ts` [DONE]

**Depends on:** TASK-0101. **Parallel with:** TASK-0103.

`scanHtmlAnchors(fileContent: string): HtmlAnchorTarget[]`. Regex for `<a id="...">`, count newlines for 0-based line numbers.

**Verification (console test):**

```typescript
const content = await app.vault.read(file);
const anchors = scanHtmlAnchors(content);
console.log('Anchors:', anchors);
```

### TASK-0105: Implement `resolveGfmTarget` in `src/resolve-target.ts` [DONE]

**Depends on:** TASK-0103 + TASK-0106.

`resolveGfmTarget(plugin, notePath, rawSlug, sourcePath): Promise<ResolutionResult>`. Decode, guard, resolve file, lookup index.

**Verification (console test):**

```typescript
const result = await resolveGfmTarget(plugin, "Target.md", "my-heading", "Source.md");
console.log('Resolution:', result);
```

### TASK-0106: Implement `src/index-cache.ts` [DONE]

**Depends on:** TASK-0101 + TASK-0103. **Parallel with:** TASK-0105.

`class IndexCache` with lazy `Map<string, Promise<DocumentIndex>>`. `get()`, `invalidate()`, `invalidateRename()`. Wire vault events in main.ts.

**Verification (console test):** Modify a note, verify index rebuilds on next `get()`.

---

## Phase 2: Automated Tests for Pure Logic

**Cycles:** Single cycle — set up Vitest, write all tests, run `npm test`.

### TASK-0201: Set up Vitest [DONE]

Add `vitest` to devDependencies. Add `"test": "vitest run"` script.

**Verification:** `npm test` runs (reports 0 tests initially).

### TASK-0202-0206: Test suites [DONE]

- `src/gfm-slugify.test.ts` — basic, Unicode, underscores, punctuation, whitespace, hyphens
- `src/document-index.test.ts` — collision-safe suffixing, endLine computation, edge cases
- `src/resolve-target.test.ts` — guard logic (GFM vs OFM vs block refs vs empty)

**Verification:** `npm test` passes all cases.

---

## Phase 3: Reveal Target Logic

**Cycles:** Single file, no dependencies on other new modules. Implements the [Reveal Layer](design.md#recommended-unified-architecture) from the unified architecture. Implements the [Reveal Layer](design.md#recommended-unified-architecture) from the unified architecture.

### TASK-0301: Implement `src/reveal-target.ts` [DONE]

**Depends on:** Phase 1 types.

`revealTargetLine(view: MarkdownView, line: number): void`. Preview mode: `applyScroll(line, {highlight: true})` with runtime cast via [local `PreviewRendererLike` interface](design.md#why-map-to-the-exact-line-number). Source mode: `Editor.setCursor` + `scrollIntoView`. Fallback: manual `is-flashing` CSS toggle matching Obsidian's internal [`highlightEl` behavior](design.md#why-map-to-the-exact-line-number).

> [!caution] Fault Analysis: Manual DOM Fallback
> The fallback manual `is-flashing` toggle requires querying the DOM (e.g., `view.containerEl.querySelectorAll`) to find the correct heading element since `applyScroll` without `{highlight}` doesn't return the target DOM node. This query must accurately map the line number to the correct HTML element, which can be fragile if Obsidian's DOM structure changes. Ensure the fallback logic robustly identifies the target element.

**Verification (console test):**

```typescript
const view = app.workspace.getActiveViewOfType(MarkdownView);
// Call from Reading view, then from Source mode
revealTargetLine(view, 10);
```

---

## Phase 4: Navigation Monkeypatches

**Cycles:** 0401 and 0403 share `patch-workspace.ts` — do together. 0404 is independent. Implements the [Router](design.md#recommended-unified-architecture), [Hover](design.md#recommended-unified-architecture), and [Autocomplete](design.md#recommended-unified-architecture) layers. Core behavior described in the [New Flow](design.md#new-flow-target-architecture).

```
Phase 1 + 3 → TASK-0401 + TASK-0403 (patch-workspace.ts)
Phase 1 + 3 → TASK-0402 (view finding, inline in patch-workspace)
Phase 1     → TASK-0404 (generate-markdown-link-patch.ts, parallel)
```

### TASK-0401: Update `openLinkText` interceptor [DONE]

**Depends on:** Phase 1 + Phase 3. **Parallel with:** TASK-0404.

New flow as documented in [design.md](design.md#new-flow-target-architecture): parse → guard → `resolveGfmTarget` → strip hash → call original → await → find view ([TASK-0402](#task-0402-find-the-view-after-openlinktext)) → `revealTargetLine`. Same-file + cross-file: one code path [Approach A](objectives.md#architecture-decisions).

>[!note]
> This approach causes a UI flicker for same-file links. Optimization is planned in [TASK-0405](#task-0405-optimize-openlinktext-for-same-file-navigation).

**Verification (console test):** Click a GFM link. Console shows parse → resolve → navigate → reveal trace.

### TASK-0402: Find the view after `openLinkText` [DONE]

**Depends on:** TASK-0401.

Post-await: `getActiveViewOfType(MarkdownView)`. Fallback: loop `getLeavesOfType('markdown')` by file path.

**Verification:** Ctrl+click a cross-file GFM link. Verify new tab view is found.

### TASK-0403: Update `trigger('hover-link')` interceptor [DONE]

**Depends on:** Phase 1. **Parallel with:** TASK-0401.

Keep existing structure. Update resolver: use `resolveGfmTarget`.

#### Original Approach (Implemented)

Since Obsidian's native `resolveSubpath` cannot disambiguate duplicate headings without line numbers, we use **Virtual Block Injection**:

1. Get the target's exact line span from `DocumentIndex`.
2. Generate a `virtualId = gfm-slug`.
3. Mutate `app.metadataCache.getFileCache(file).blocks` by injecting a temporary `BlockCache` item covering the exact `[target.line, target.endLine]`.
4. Rewrite `data.linktext` to `#^${virtualId}`.
5. Call original `trigger`. Page Preview handles it natively.
6. Clean up the cache via `setTimeout` (1500ms).

> [!warning] Fault Analysis: Virtual Block Injection Failure
> This approach failed because Obsidian's `HoverPopover` relies on the immutable `metadataCache` state. Mutating `cache.blocks` on the fly broke its internal state machine, causing it to crash or link nowhere. See [Bug Tracker: Hover Preview fails](task-bugs.md#1-hover-preview-fails-hovering-cant-find--links-nowhere) for the documented attempts to fix this.

#### Updated Approach (Implemented)

We revert to rewriting the linktext to target the native heading text (e.g., `#Native Heading`), which allows Obsidian's native preview renderer to resolve it safely.

1. Get the target heading text from `DocumentIndex`.
2. Rewrite `data.linktext` to `#${target.heading}`.
3. Call original `trigger`. Page Preview handles it natively.
*(Note: As a trade-off, Page Preview for duplicate headings will always show the first occurrence.)*

**Verification:** Ctrl/Cmd hover over GFM link to a heading. Page Preview shows the heading natively. (For duplicate headings, verify it shows the first occurrence).

>[!note]
>Due to the limitation of only showing the first occurrence, a new approach is detailed in [TASK-0406](#task-0406-implement-custom-hover-preview-ui).

### TASK-0404: Implement Autocomplete monkeypatch [DONE]

**Depends on:** Phase 1. **Parallel with:** TASK-0401+0403.

#### Original Plan: `generateMarkdownLink`

New file `src/generate-markdown-link-patch.ts`. Monkeypatch `FileManager.prototype.generateMarkdownLink(file, sourcePath, subpath?, alias?)`.

> [!NOTE] Subpath → GFM slug transformation
> `generateMarkdownLink` receives an **already-formatted subpath** from Obsidian (e.g., `#My Heading` or `#URL%20Encoded%20Heading`). The patch must **reverse this back to heading text, then slugify it**:
>
> ```text
> 1. If subpath starts with "#":
>    a. Strip leading "#" → rawSubpath
>    b. Guard: skip block refs ("^...") and footnotes ("[^...") → pass through unmodified
>    c. Decode: decodeURIComponent(rawSubpath) → headingText
>       (fallback to rawSubpath if decoding throws)
>    d. GFM-slugify: gfmSlugify(headingText) → gfmSlug
>    e. Reconstruct: subpath = "#" + gfmSlug
> 2. Pass (modified or original) subpath to original generateMarkdownLink
> ```
>
> [!warning] Fault Analysis: Subpath Reversal Fragility
> Decoding and reversing Obsidian's already-formatted subpaths can be brittle if Obsidian introduces new URL encoding rules or edge-case characters. A safer fallback is to always verify if the generated `headingText` actually exists in the file's `DocumentIndex` before replacing it with a GFM slug. If it doesn't match a known heading, pass it through unmodified to prevent data corruption.

#### Updated Approach (Implemented): `EditorSuggest`

During implementation, it was discovered that native autocompletion leverages internal `value` objects inserted directly, bypassing `generateMarkdownLink`. The approach was shifted to monkeypatch Obsidian's native `EditorSuggest.selectSuggestion`.

New file [src/patch-editor-suggest.ts](../../src/patch-editor-suggest.ts) dynamically intercepts the suggestion `value` object right before text insertion.

> [!NOTE] Updated Subpath → GFM slug transformation
>
> ```text
> 1. User selects autocomplete suggestion from dropdown.
> 2. We intercept `selectSuggestion(value, evt)`.
> 3. We use `resolveGfmSlug(value, plugin.app, this)` to compute the exact GFM slug.
>    a. This advanced helper maps the exact `Nth` duplicate clicked in the dropdown to the exact `Nth` identical header in `metadataCache`.
> 4. We mutate `value.subpath` to the generated `#gfm-slug`.
> 5. We call the original `selectSuggestion(value, evt)`, letting Obsidian natively insert the string while keeping the alias intact (e.g., `[Original Header](#gfm-slug)`).
> ```

**Validation Link:** Confirmed working as designed, resolving the [Alias Loss and Duplicate Suffix bug in task-bugs.md](task-bugs.md#21-autocomplete-alias-loss--missing-duplicate-suffixes).

**Verification:** Open `[[` autocomplete, select heading. Verify GFM slug in inserted link. Click to verify navigation.

>[!note]
>Additional mitigations for alias loss and cache latency are documented in [TASK-0407](#task-0407-fix-editorsuggest-alias--cache-latency).

### TASK-0405: Optimize `openLinkText` for Same-File Navigation [DONE]

**Depends on:** TASK-0401.

To resolve the jump-to-top flicker identified in architectural analysis, intercept `openLinkText`. If `sourcePath === targetPath` AND `!newLeaf` (same-file navigation without modifier keys), bypass calling the original `openLinkText` completely and immediately call `revealTargetLine`.

**Verification:** Ctrl/Cmd hover over GFM link to a duplicate heading. Page Preview shows the exact duplicate instance, not the first one.

### TASK-0407: Fix EditorSuggest Alias & Cache Latency [DONE]

**Depends on:** TASK-0404.

1. **Wikilink Alias Loss**: Check `app.vault.getConfig("useMarkdownLinks")`. If false, explicitly set `value.alias = value.heading` before inserting to preserve the readable UI text.
2. **Cache Latency**: Document that rapid typing can cause stale `metadataCache` reads during autocomplete suffix generation for v1.

**Verification:** Toggle "Use Markdown links" off. Autocomplete a duplicate heading. Verify alias is inserted correctly (`[[File#gfm-slug|Original Heading]]`).

---

## Phase 5: Debug Logging and Final Wiring

**Cycles:** Linear — debug.ts first, then main.ts wiring.

### TASK-0501: Implement `src/debug.ts` [DONE]

**Depends on:** Phase 1-4.

`debugLog(event, payload)` with `DEBUG_ENABLED` flag. 15 event types covering parse, resolve, index, cache, navigation, reveal, errors.

**Verification:** Set `DEBUG_ENABLED = true`, click a link, check console.

### TASK-0502: Wire everything in `main.ts` [DONE]

**Depends on:** TASK-0501.

Instantiate `IndexCache`, register vault events, apply 3 monkeypatches, store teardowns.

**Verification:** Load plugin → click link → unload plugin → click link. Native behavior restored.

---

## Phase 6: Manual Validation

**Cycles:** Interactive — execute validation matrix, fix issues, re-test.

### TASK-0601: Verify test vault at `/home/lucas_galdino/my_pc/projects/test_vault` [DONE]

### TASK-0602: Execute validation matrix (see `validation.md`) [DONE]

### TASK-0603: Verify autocomplete behavior [DONE]

### TASK-0604: Verify debug logs trace full pipeline [DONE]

---

## Phase 7: Release Readiness

**Cycles:** Linear — test → build → docs → review.

### TASK-0701: `npm test` — all pass [DONE]

### TASK-0702: `npm run build` — typescript + esbuild succeed [DONE]

### TASK-0703: Update `README.md`, `CHANGELOG.md` [DONE]

### TASK-0704: Git review — intended files only [DONE]

### TASK-0705: Publish v1.2.0 Release [DONE]

Cut the `1.2.0` release on GitHub, and submit a PR to `obsidian-releases` if intended for the community registry.

---

## Phase 8: Future Enhancements

These tasks represent logical next steps for the project to increase robustness and feature completeness.

### TASK-0801: Implement End-to-End (E2E) Test Suite [TODO]

While unit tests guard the internal logic, the plugin heavily relies on monkeypatching `app.workspace.openLinkText`. Creating an E2E test suite (using e.g. `obsidian-plugin-e2e`) will ensure future Obsidian updates do not break the patch silently.

### TASK-0804: Fix Cross-BaseSlug Collision in buildDocumentIndex [DONE]

**Depends on:** TASK-0103. **Bug:** [Bug 3](task-bugs.md#3-gfm-collision-suffix-ambiguity-the-commands-problem--resolved).

The per-baseSlug collision counter (`slugCounts`) was blind to cross-baseSlug collisions — the 2nd `## Commands` heading would get slug `commands-1` which was already claimed by the literal `## Commands-1` heading, causing `Map.set()` to silently overwrite the literal's entry.

**Fix:** Replaced `slugCounts` with a direct `index.has(finalSlug)` while-loop. The algorithm now checks the actual index for collisions, catching both same-text duplicates AND cross-baseSlug conflicts. Removed the now-unused `slugCounts` Map.

**Tests added:** 2 new test cases in `document-index.test.ts` (19 total, up from 14):

- `"handles cross-baseSlug collision (literal matches collision suffix)"`
- `"handles cross-baseSlug collision with reversed heading order"`

**Verification:** `npm test` passes 19/19. Click a `#commands-1` link in the test vault — verify it navigates to the literal `## Commands-1` heading, not a duplicate `## Commands`.

### TASK-0802: Toggle Setting for HTML Anchors [DEFERRED — v2]

The plugin can already parse `<a id="...">` HTML tags in the DocumentIndex. Expose a Settings tab in Obsidian to let users manually toggle HTML anchor resolution on/off. **Deferred to v2 — HTML anchor click/hover support must be solved first.**

### TASK-0803: Investigate & Fix HTML Anchor Click in Source/Live Preview [DEFERRED — v2]

**Depends on:** TASK-0401, TASK-0301. **Objectives:** [OBJ-005](objectives.md). **Bug:** [Bug 5](task-bugs.md#5-html-anchor-click-only-works-in-reading-mode--deferred-to-v2).

HTML anchor links (`#html-anchor-section`, `#html-anchor-header`, etc.) only resolve in Reading mode. In Live Preview, nothing works. In Source mode, behavior is click-position-dependent (works only when Ctrl+clicking the `(file.md#anchor)` part of a markdown link, not the `[alias]` part).

**Root cause is not yet confirmed** — needs targeted debug logging before attempting a fix. See the [investigation plan](task-bugs.md#10-html-anchor-click-only-works-in-reading-mode) for the 5 investigation steps.

**Investigation steps:**

1. [ ] Add `debugLog("openLinkText:entry", { linktext, sourcePath, mode })` at the **absolute top** of the `openLinkText` interceptor — before any guard.
2. [ ] Add `debugLog("openLinkText:step5-fallback", { targetType, targetLine, viewMode })` inside STEP 5.
3. [ ] Add `debugLog("reveal:attempt", { line, mode, viewType })` at the top of `revealTargetInView`.
4. [ ] Test each mode × link-format × click-position combination using the [click-navigation matrix](validation/click-navigation.md#mode--link-format-matrix).
5. [ ] Determine: does `openLinkText:entry` fire for all click positions? Does STEP 5 get reached? Does `reveal:attempt` fire?

**Likely fix candidates (depending on investigation outcome):**

- If `openLinkText` doesn't fire for certain click positions → investigate Obsidian's CodeMirror click handlers for additional interception points.
- If `openLinkText` fires but STEP 5 fails → fix `revealTargetInView` for Source/LP mode non-heading targets:
  + Source mode: use `editor.setCursor({ line, ch: 0 })` + `editor.scrollIntoView()` instead of `setEphemeralState`.
  + Live Preview: may need `view.editor` reference (Live Preview uses CodeMirror internally).
- If `revealTargetInView` fires but doesn't scroll → may need to extend HTML anchor `endLine` beyond `line + 1`.

**Verification:** Click an HTML anchor link in Live Preview and Source mode. Verify navigation to the correct line with highlight. See [`click-navigation.md`](validation/click-navigation.md) and [`reveal-target.md`](validation/reveal-target.md) for detailed validation procedures.

---

## Phase 9: Dev Branch Cleanup & Documentation

**Cycles:** Several independent tasks. These emerged from user annotations (`[^obs-*]` footnotes, `>[!warning]` markers) during the code documentation pass.

### TASK-0901: Replace console.log with debugLog [DONE]

**Depends on:** TASK-0501.

All raw `console.log` calls in `patch-workspace.ts` (hover-link interceptor) replaced with structured `debugLog()` calls. The large warning comment block documenting this issue has been removed. `console.error` calls preserved for actual error conditions.

**Verification:** `npm run build` passes. Set `DEBUG_ENABLED = false` — no `[GFM Heading Links]` output. Set to `true` — structured debug output appears.

### TASK-0902: Proper Debug System Design [TODO]

**Depends on:** TASK-0901.

Design and implement a more sophisticated debugging system to replace the current binary `DEBUG_ENABLED` toggle. Requirements from user annotations:

- Log levels (not just on/off)
- python-decorator-like opt-in per function
- File output for test logs
- Keep the simplicity of the current system for production builds

**Verification:** TBD after design.

### TASK-0903: Create Logs Folder for Test Output [TODO]

**Depends on:** TASK-0902.

Create a `logs/` directory in the repository. Wire test output (both Vitest results and manual validation traces) to be saved there. Add to `.gitignore` for main branch, keep in dev branches.

**Verification:** Run `npm test`, verify log files created in `logs/`.

### TASK-0904: Reveal-Target Validation Guide [DONE]

**Depends on:** Phase 6 validation.

Create a validation guide that answers the question from `reveal-target.ts` `[^obs-3a]`: "Is `revealTargetInView` really a fallback or the main mechanism?"

**Resolution:** Created [`validation/reveal-target.md`](validation/reveal-target.md) with mode behavior tables, target type behavior analysis, and the answer: for heading targets, `revealTargetInView` is NOT reached (Virtual Block Injection handles it); for HTML anchor targets, it IS the primary mechanism. Validation testing during Session 3 revealed related bugs (Bug 6 HTML anchor hover, Bug 10 HTML anchor click, Bug 7 autocomplete HTML, Bug 8 Commands collision) — all documented in [`task-bugs.md`](task-bugs.md#session-3-validation-matrix-testing--2026-07-14).

The guide covers:

1. Test setup with `validation-target.md` and `validation-links.md`
2. Test procedure matrix (14 scenarios)
3. Observed results cross-referenced to bugs
4. How to verify which code path executed (ideal vs fallback)

**Verification:** See [`validation/validation.md`](validation/validation.md#reveal-target-path-validation) for the detailed test procedure and [Session 3 bugs](task-bugs.md#session-3-validation-matrix-testing--2026-07-14) for discovered issues.

### TASK-0905: Harder GFM Slug Test Cases [DONE]

**Depends on:** TASK-0202.

Add edge case test cases to `src/test/gfm-slugify.test.ts` as noted in the `>[!warning]` annotation.

**Resolution:** Added 3 new test blocks (11 assertions) covering:

- Degenerate inputs: empty string, pure punctuation, whitespace-only → `""`
- Numeric/alphanumeric: `"123 456"`, `"1. Introduction"`, `"Step 1"`, `"Version 2.0 Release"`
- Underscore/hyphen interaction: `"__init__"`, `"my_custom-heading"`, `"hello_world test"`, `"_private"`

Skipped from the original list: 500+ char headings (overkill for unit test), RTL/LTR scripts (hard to verify deterministically), emoji-only (already covered by punctuation test — emoji are stripped).

**Verification:** `npm test` passes with 17 tests (was 14).

### TASK-0906: Fix Unused HeadingCache Import [DONE]

**Depends on:** TASK-0103.

Remove the unused `HeadingCache` import from `src/document-index.ts`. The `!FIX` annotation noted it was imported but only used as a type via `CachedMetadata`.

**Resolution:** The import was removed. A comment remains on line 39 explaining that `HeadingCache` is used implicitly via `CachedMetadata.heading`. No code changes needed.

**Verification:** `npx tsc --noEmit` passes without the "imported but not used" warning.

### TASK-0907: Plan Documentation Refresh [DONE]

**Depends on:** All implemented tasks.

Updated all plan files to reflect current implementation state:

- `plan.md`: Status updated, link fixed
- `objectives.md`: OBJ-003 and OBJ-007 descriptions corrected (generateMarkdownLink → EditorSuggest)
- `design.md`: "Patched Flow" relabeled as historical v1
- `files.md`: Removed non-existent `generate-markdown-link-patch.ts` reference
- `tasks.md`: Phase 1 [needs-testing] → [DONE], Phase 9 tasks added

**Verification:** All plan files are internally consistent with the actual codebase.

---

## Phase 10: v1.3 — Code Quality Refactoring + Settings & Wikilink Alias

**Cycles:** Refactoring and feature tracks are parallel — both must complete before v1.3 release.

```
Refactoring track (pass 1):
  TASK-1004 (isGfmSlug) ──→ TASK-1005 (unify hover) ──→ TASK-1006 (shared VBI)
                                                      ──→ TASK-1007 (split patch-ws)
  TASK-1008 (rename variables) — independent
  TASK-1009 (O(n) algorithm) — independent

Feature track:
  TASK-1003 (settings tab) ──→ TASK-1002 (link affixes)
  TASK-1001 (wikilink alias) — independent, depends on TASK-0404

Refactoring track (pass 2 — code review findings):
  TASK-1010 (extract mutation pipeline) — depends on TASK-1007, TASK-1008
  TASK-1011 (link normalization) — depends on TASK-1005, TASK-1002
  TASK-1012 (de-duplicate resolution) — depends on TASK-1005
  TASK-1013 (declarative settings) — depends on TASK-1003
```

**Pass 1** (TASK-1001–1009): 6 refactoring tasks emerged from a comprehensive code review (2026-07-16) that identified 2 critical DRY violations and 4 moderate architectural issues. See [task-bugs.md §Session 4](task-bugs.md#session-4-code-review--2026-07-16) for the full analysis and [design.md §5.6–5.10](design.md#56-gfm-slug-guard-duplicated-across-modules--open) for known limitations. The feature tasks (TASK-1001, TASK-1002, TASK-1003) were previously deferred to v2 but are easier and more user-visible than HTML anchor support.

**Pass 2** (TASK-1010–1013): 4 additional tasks from a second-pass code review (2026-07-16) targeting god-function anti-patterns, separation-of-concerns violations, code duplication, and API migration debt. See [OBJ-017–OBJ-020](objectives.md#v13-code-quality-objectives--second-review-pass). All block the v1.3 release.

---

### TASK-1004: Extract `isGfmSlug()` Shared Guard Function [DONE]

**Depends on:** nothing (pure function). **Parallel with:** TASK-1003, TASK-1008, TASK-1009. **Objectives:** [OBJ-011](objectives.md#v13-code-quality-objectives--refactoring-from-code-review). **Bug:** [Bug 7](task-bugs.md#7-gfm-slug-guard-duplicated-dry--open).

Extract the GFM slug detection heuristic into a single exported predicate function in `gfm-slugify.ts`. Both `resolve-target.ts` and `patch-workspace.ts` currently implement the same guard inline.

**Implementation:**

1. Add `isGfmSlug(slug: string): boolean` to `src/gfm-slugify.ts`:

   ```typescript
   export function isGfmSlug(slug: string): boolean {
       return slug.length > 0
           && !/[A-Z]/.test(slug)
           && !/%[0-9A-Fa-f]{2}/.test(slug)
           && !slug.startsWith("^")
           && !slug.startsWith("[^");
   }
   ```

2. Replace inline guard in `src/resolve-target.ts` (`resolveGfmTarget`, STAGE 1) with `isGfmSlug(rawSlug)`.
3. Replace inline guard in `src/patch-workspace.ts` (`trigger('hover-link')` handler) with `isGfmSlug(slug)`.
4. Add unit test `src/test/gfm-slugify.test.ts`: "isGfmSlug detects GFM vs non-GFM slugs" — test lowercase, uppercase, encoded, block refs, footnotes, empty.

**Verification:** `npm test` passes with new `isGfmSlug` test cases. Both click and hover navigation behave identically to pre-refactoring (no functional change).

**Depends on:** nothing (pure function). **Parallel with:** TASK-1003, TASK-1008, TASK-1009. **Objectives:** [OBJ-011](objectives.md#v13-code-quality-objectives--refactoring-from-code-review). **Bug:** [Bug 7](task-bugs.md#7-gfm-slug-guard-duplicated-dry--resolved).

**Completed 2026-07-16.** Extracted `isGfmSlug()` into `gfm-slugify.ts` with full JSDoc. Replaced inline guards in `resolve-target.ts` and `patch-link-hover.ts`. Discovered and fixed an inverted-condition bug in `resolve-target.ts` (guard was passthrough-ing valid GFM slugs). Added 6 unit tests (16 assertions). `npm test` passes 25/25 (was 19)

---

### TASK-1005: Unify Hover-Link Resolution with IndexCache [DONE]

**Depends on:** TASK-1004. **Parallel with:** (blocks TASK-1006, TASK-1007). **Objectives:** [OBJ-012](objectives.md#v13-code-quality-objectives--refactoring-from-code-review). **Bug:** [Bug 8](task-bugs.md#8-hover-resolution-fork-dry--require-abuse--resolved).

**Implementation:**

1. Add `resolveGfmTargetSync()` to `src/resolve-target.ts`:
   + Same GFM guard → file resolution → `buildDocumentIndex(cache)` (no `await vault.read()`, no HTML anchors).
   + Returns `ResolutionResult` (same discriminated union).
   + Rationale: hover events must mutate the payload synchronously before Obsidian processes the event. Async disk I/O (`vault.read()`) is not possible. The current hover handler already skips HTML anchors, so this is parity.
2. Replace the entire inline resolution block in `patch-workspace.ts` (`trigger('hover-link')`) with:

   ```typescript
   const result = resolveGfmTargetSync(plugin, notePath, decodedSlug, sourcePath);
   if (result.type === "success" && result.target?.type === "heading") {
       // injectVirtualBlock(...) — from TASK-1006
   }
   ```

3. Remove the `require("./document-index")` line and the inline `buildDocumentIndex` call.

**Verification:** Hover over a GFM heading link. Page Preview activates and shows the correct heading. Hover over a duplicate heading — shows the intended Nth occurrence (same behavior as current). `npm run build` succeeds with no `require()` calls.

**Completed 2026-07-16.** Added `resolveGfmTargetSync()` to `resolve-target.ts` — synchronous variant using only metadata cache (no `vault.read()`, no HTML anchors). Same `ResolutionResult` return type. `patch-link-hover.ts` calls this instead of ~80 lines of inline resolution. Eliminated the `require("./document-index")` call. `tsc --noEmit` now passes with zero errors. `npm run build` succeeds.

---

### TASK-1006: Extract Shared Virtual Block Injection Utility [DONE]

**Depends on:** TASK-1005. **Parallel with:** TASK-1007. **Objectives:** [OBJ-013](objectives.md#v13-code-quality-objectives--refactoring-from-code-review). **Bug:** [Bug 9](task-bugs.md#9-virtual-block-injection-duplicated-dry--magic-number--resolved).

**Implementation:**

1. Create `src/virtual-block.ts`:

   ```typescript
   export const VIRTUAL_BLOCK_CLEANUP_MS = 1500;

   export function injectVirtualBlock(
       cache: CachedMetadata,
       slug: string,
       position: any,
       prefix: string
   ): () => void {
       const virtualId = `${prefix}${slug}`;
       if (!cache.blocks) cache.blocks = {};
       cache.blocks[virtualId] = { id: virtualId, position };
       const timer = setTimeout(() => {
           if (cache.blocks?.[virtualId]) delete cache.blocks[virtualId];
       }, VIRTUAL_BLOCK_CLEANUP_MS);
       return () => { clearTimeout(timer); if (cache.blocks?.[virtualId]) delete cache.blocks[virtualId]; };
   }
   ```

2. Replace inline injection in click handler (`openLinkText`): `injectVirtualBlock(cache, target.slug, target.position, "gfm-click-")`.
3. Replace inline injection in hover handler (`trigger`): `injectVirtualBlock(cache, decodedSlug, target.position, "gfm-")`.
4. Use returned cleanup function instead of naked `setTimeout(..., 1500)`.

**Verification:** Click a GFM link — navigation and highlight work. Hover over a GFM link — Page Preview works. Virtual blocks are cleaned up after navigation/preview completes.

**Completed 2026-07-16.** Created `src/virtual-block.ts` with `injectVirtualBlock(cache, slug, position, prefix): () => void` and `VIRTUAL_BLOCK_CLEANUP_MS = 1500` constant. Returns cleanup function. Used by both `patch-link-click.ts` and `patch-link-hover.ts`.

---

### TASK-1007: Split `patch-workspace.ts` by Responsibility [DONE]

**Depends on:** TASK-1005. **Parallel with:** TASK-1006. **Objectives:** [OBJ-014](objectives.md#v13-code-quality-objectives--refactoring-from-code-review). **Bug:** [Bug 10](task-bugs.md#10-patch-workspacets-srp-violation--open).

Split the 270-line `patch-workspace.ts` into two focused modules, each handling one Obsidian API interception point.

**Implementation:**

1. Create `src/patch-link-click.ts`:
   + Export `applyClickPatch(plugin: GfmHeadingLinksPlugin): () => void`.
   + Contains the `workspace.openLinkText` monkeypatch (currently lines ~1–150 of `patch-workspace.ts`).
   + Uses `resolveGfmTarget()` (async, full pipeline with HTML anchors).
   + Uses `injectVirtualBlock()` from TASK-1006.
2. Create `src/patch-link-hover.ts`:
   + Export `applyHoverPatch(plugin: GfmHeadingLinksPlugin): () => void`.
   + Contains the `workspace.trigger('hover-link')` monkeypatch (currently lines ~150–270 of `patch-workspace.ts`).
   + Uses `resolveGfmTargetSync()` from TASK-1005.
   + Uses `injectVirtualBlock()` from TASK-1006.
3. Update `main.ts`: import both, call both, store both teardown functions.
4. Delete `src/patch-workspace.ts`.

**Verification:** `npm run build` succeeds. Click navigation works. Hover preview works. Unload plugin — both patches are cleaned up, native behavior restored.

**Completed 2026-07-16.** `patch-workspace.ts` deleted. Replaced by `patch-link-click.ts` (`applyClickPatch`, async + HTML anchors) and `patch-link-hover.ts` (`applyHoverPatch`, sync, no HTML anchors). `main.ts` imports both separately.

---

### TASK-1008: Rename Weak Variable Names [DONE]

**Depends on:** nothing. **Parallel with:** all other tasks. **Objectives:** [OBJ-015](objectives.md#v13-code-quality-objectives--refactoring-from-code-review). **Bug:** [Bug 11](task-bugs.md#11-weak-variable-naming--resolved).

**Implementation:**

1. In `patch-workspace.ts` (or `patch-link-hover.ts` after TASK-1007):
   + `data` → `hoverEventPayload` (the event payload containing `linktext`, `sourcePath`, `hoverParent`).
2. In `patch-editor-suggest.ts`:
   + `value` → `suggestionValue` (the suggestion object selected from the dropdown).
   + `mutated` → `didModifySubpath` (boolean tracking whether subpath was rewritten).
3. Rename `src/link-target.ts` → `src/types.ts`. Update all 9 import references across the codebase:
   + `document-index.ts`, `index-cache.ts`, `resolve-target.ts`, `reveal-target.ts`, `patch-editor-suggest.ts`, `patch-workspace.ts` (or split files), `main.ts`, and test files.

**Verification:** `npx tsc --noEmit` passes. `npm test` passes. `npm run build` succeeds. All imports resolve correctly.

**Completed 2026-07-16.** Renamed: `data` → `hoverEventPayload` (done in TASK-1007), `value` → `suggestionValue`, `mutated` → `didModifySubpath`. File rename: `link-target.ts` → `types.ts` with all 5 imports updated (`document-index.ts`, `index-cache.ts`, `resolve-target.ts`, `reveal-target.ts`, `resolve-target.test.ts`). `tsc --noEmit` passes with zero errors.

---

### TASK-1009: Stack-Based O(n) Section Boundary Algorithm [DONE]

**Depends on:** nothing (pure algorithm change). **Parallel with:** all other tasks. **Objectives:** [OBJ-016](objectives.md#v13-code-quality-objectives--refactoring-from-code-review). **Bug:** [Bug 12](task-bugs.md#12-on2-section-boundary-algorithm--resolved).

Replace the O(n²) nested loop in `buildDocumentIndex` with an O(n) single-pass stack algorithm.

**Implementation:**

1. Replace the inner `for (let j = i + 1; ...)` loop with a stack-based approach:

   ```typescript
   const stack: { index: number; heading: HeadingCache; baseSlug: string }[] = [];
   for (let i = 0; i < headings.length; i++) {
       const current = headings[i];
       // Pop headings from stack that are closed by this heading
       while (stack.length > 0 && current.level <= stack[stack.length - 1].heading.level) {
           const popped = stack.pop()!;
           // Finalize popped heading: endLine = current.start.line - 1
           endLines[popped.index] = current.position.start.line - 1;
       }
       stack.push({ index: i, heading: current, baseSlug: gfmSlugify(current.heading) });
   }
   // Remaining stack entries extend to end of file
   for (const entry of stack) {
       endLines[entry.index] = lastLineOfFile;
   }
   ```

2. Second pass: build `HeadingAnchorTarget` entries using pre-computed `endLines[]` array and `allocateUniqueSlug()`.
3. All 19 existing `document-index.test.ts` tests must pass unchanged.
4. Add a stress test: 100 nested headings, verify index built in <50ms.

**Verification:** `npm test` passes all 19 existing tests plus new stress test. Manual: click a GFM link in a file with deep heading hierarchy — navigation and section highlighting work identically to pre-refactoring.

**Completed 2026-07-16.** Replaced O(n²) nested loop in `buildDocumentIndex` with 2-pass O(n) approach: Pass 1 uses a stack to compute all `endLine`/`endOffset` values (pop when same-or-higher-level heading encountered), Pass 2 builds `HeadingAnchorTarget` entries. All 25 existing tests pass unchanged. Code is both faster and simpler (no inner loop, no `break`)

---

### TASK-1003: Plugin Settings Tab [DONE]

**Depends on:** Phase 1. **Objectives:** [OBJ-010](objectives.md#v13-objectives--settings--wikilink-alias).

**Completed 2026-07-16.** Created `src/settings.ts` with `GfmSettingsTab` (extends `PluginSettingTab`) and `GfmSettings` interface (`prefix`/`suffix`). Registered in `main.ts`. Settings persisted via `loadData()`/`saveData()`. `GfmHeadingLinksPlugin` interface extended with `settings` property. Default: empty prefix/suffix.

### TASK-1001: Wikilink-Aware Editor Suggestions [DONE]

**Depends on:** TASK-0404. **Objectives:** [OBJ-009](objectives.md#v13-objectives--settings--wikilink-alias).

When the user has "Use Markdown links" disabled (wikilinks enabled in Obsidian settings), autocomplete should output `[[file#gfm-slug|Original Heading]]` with the pipe-alias, matching the behavior that already works for markdown link format (`[Original Heading](file.md#gfm-slug)`).

Currently:

- Markdown links: `[Café y Niño](file.md#café-y-niño)` ✅ alias preserved
- Wikilinks: `[[file#café-y-niño]]` ❌ no alias (should be `[[file#café-y-niño|Café y Niño]]`)

Implementation approach:

1. In `applyEditorSuggestPatches`, after mutating `value.subpath`, check `app.vault.getConfig("useMarkdownLinks")`.
2. If wikilinks are enabled and `value.heading` exists, set `value.alias = value.heading` so Obsidian's native insertion includes the pipe-alias.

**Verification:** Toggle "Use Markdown links" off. Autocomplete a heading. Verify output is `[[file#gfm-slug|Original Heading]]`.

**Completed 2026-07-16.** Added wikilink alias injection to `applyEditorSuggestPatches`. When `app.vault.getConfig("useMarkdownLinks")` is `false` (wikilinks enabled), sets `suggestionValue.alias = suggestionValue.heading` after HTML stripping. Handles both direct and nested (`item.`) suggestion shapes. Output: `[[file#gfm-slug|Original Heading]]`.

### TASK-1002: User-Customizable Link Affixes [DONE]

**Depends on:** TASK-0404, TASK-1003. **Objectives:** [OBJ-010](objectives.md#v13-objectives--settings--wikilink-alias).

Expose a plugin settings tab allowing users to configure prefix and suffix characters that are prepended/appended to GFM links during autocomplete.

Example: user sets prefix = `¶` → autocomplete outputs `[[file#¶gfm-slug]]` or `[Heading](file.md#¶gfm-slug)`.

Implementation approach:

1. Add settings registration in `main.ts` using `Plugin.addSettingTab()`.
2. Store prefix/suffix in plugin data (via `loadData()`/`saveData()`).
3. In `applyEditorSuggestPatches`, after generating the slug, apply the user's prefix/suffix to `value.subpath`.
4. Strip affix characters in `gfmSlugify` or handle them separately so they don't break slug resolution (the affix should be part of the display, not the target).

**Verification:** Set prefix to `§`, autocomplete a heading, verify link contains `§` prefix. Click the link — verify navigation still resolves correctly (prefix stripped before slug lookup).

**Completed 2026-07-16.** Affix application: `applyEditorSuggestPatches` reads `plugin.settings.prefix`/`suffix` and applies them to `suggestionValue.subpath` after slug generation. Affix stripping: `stripAffixes()` helper in `resolve-target.ts` strips prefix/suffix before DocumentIndex lookup in both `resolveGfmTarget()` and `resolveGfmTargetSync()`. Gracefully handles `undefined` settings (tests pass)

### TASK-1010: Extract `selectSuggestion` Mutation Pipeline [DONE]

**Depends on:** TASK-1007 (split patch-ws), TASK-1008 (renamed variables). **Parallel with:** TASK-1011, TASK-1012. **Objectives:** [OBJ-017](objectives.md#v13-code-quality-objectives--second-review-pass).

Extract the 120-line `selectSuggestion` wrapper in `patch-editor-suggest.ts` into a pure, independently testable `transformSuggestion()` function. The current wrapper performs 5 unrelated mutations inline:

1. GFM slug resolution (two strategies — precise `resolveGfmSlug()` + fallback `gfmSlugify()`)
2. HTML tag stripping from `heading` aliases
3. Wikilink alias injection (`useMarkdownLinks` check)
4. User-customizable prefix/suffix application
5. Error swallowing via try/catch

Each of these is a distinct concern that should be independently unit-testable without mocking Obsidian's suggestor infrastructure.

**Implementation:**

1. Create a pure function in `src/patch-editor-suggest.ts`:

   ```typescript
   function transformSuggestion(
       suggestionValue: any,
       plugin: GfmHeadingLinksPlugin,
       suggestInstance?: any
   ): { suggestionValue: any; didModifySubpath: boolean } {
       // Step 1: Strip HTML from heading aliases
       // Step 2: Resolve GFM slug (precise + fallback)
       // Step 3: Apply wikilink alias if needed
       // Step 4: Apply user affixes (prefix/suffix)
       return { suggestionValue, didModifySubpath };
   }
   ```

2. Replace the inline mutation block in the `selectSuggestion` wrapper with:

   ```typescript
   suggest.selectSuggestion = function(suggestionValue: any, evt: any) {
       try {
           const result = transformSuggestion(suggestionValue, plugin, this);
           suggestionValue = result.suggestionValue;
           if (result.didModifySubpath) {
               debugLog("suggest:mutated", { subpath: suggestionValue?.subpath });
           }
       } catch (e) {
           console.error("[GFM Heading Links] Error in editorSuggest patch:", e);
       }
       return originalSelectSuggestion.call(this, suggestionValue, evt);
   };
   ```

3. Add unit tests for `transformSuggestion()`:
   + HTML stripping: `<b>Test</b>` → `Test`
   + Slug resolution: `My Heading` → `#my-heading`
   + Wikilink alias: `useMarkdownLinks=false` → `alias` set
   + Affix application: `prefix="§"` → `#§my-heading`
   + Combined: all mutations applied in correct order

**Files to touch:** `src/patch-editor-suggest.ts`, `src/test/patch-editor-suggest.test.ts` (new).

**Verification:** `npm test` passes with new `transformSuggestion` test cases. `npm run build` succeeds. Autocomplete behavior is identical to pre-refactoring. The `selectSuggestion` wrapper is ≤15 lines.

### TASK-1011: Create Link Normalization Layer in `src/link-parse.ts` [DONE]

**Depends on:** TASK-1005 (unified hover resolution), TASK-1002 (affix feature). **Parallel with:** TASK-1010, TASK-1013. **Objectives:** [OBJ-018](objectives.md#v13-code-quality-objectives--second-review-pass).

Move `stripAffixes()` out of `resolve-target.ts` into a new `src/link-parse.ts` module. The resolution engine should receive clean slugs — it should not know about cosmetic autocomplete decorations. Currently `resolve-target.ts` imports `GfmSettings` to undo what `patch-editor-suggest.ts` did with those same settings, creating a bidirectional coupling anti-pattern.

**Implementation:**

1. Create `src/link-parse.ts`:

   ```typescript
   import type { GfmSettings } from "./settings";

   /**
    * Normalizes a raw link slug by stripping cosmetic affixes and URL-decoding.
    * Callers (patch-link-click, patch-link-hover) should normalize slugs before
    * passing them to the resolution pipeline.
    */
   export function normalizeSlug(rawSlug: string, settings?: GfmSettings): string {
       let slug = rawSlug;

       // URL decode
       try { slug = decodeURIComponent(slug); } catch { /* keep raw */ }

       // Strip user-configured prefix/suffix
       const prefix = settings?.prefix || "";
       const suffix = settings?.suffix || "";
       if (prefix && slug.startsWith(prefix)) slug = slug.substring(prefix.length);
       if (suffix && slug.endsWith(suffix)) slug = slug.substring(0, slug.length - suffix.length);

       return slug;
   }
   ```

2. In `patch-link-click.ts`: call `normalizeSlug(slug, plugin.settings)` before `resolveGfmTarget()`. Remove the duplicated URL-decode from the resolution pipeline call site.
3. In `patch-link-hover.ts`: call `normalizeSlug(slug, plugin.settings)` before `resolveGfmTargetSync()`.
4. In `resolve-target.ts`: **remove** the `stripAffixes()` function entirely. **Remove** the `import type { GfmSettings }` import. The resolution functions now receive pre-normalized slugs and can drop the affix-stripping fallback (`index.get(decodedSlug)` after `stripAffixes` fails).
5. Update existing `resolve-target.test.ts` to reflect the API change (slug argument is now pre-normalized).

**Files to touch:** `src/link-parse.ts` (new), `src/patch-link-click.ts`, `src/patch-link-hover.ts`, `src/resolve-target.ts`, `src/test/resolve-target.test.ts`.

**Verification:** `npm test` passes. `npm run build` succeeds. `resolve-target.ts` has zero imports from `settings.ts`. Click a GFM link with affix characters — navigation resolves correctly. Hover over a GFM link with affix characters — Page Preview works.

### TASK-1012: Eliminate Sync/Async Resolution Pipeline Duplication [DONE]

**Depends on:** TASK-1005 (unified hover resolution). **Parallel with:** TASK-1010, TASK-1011. **Objectives:** [OBJ-019](objectives.md#v13-code-quality-objectives--second-review-pass).

`resolveGfmTarget()` (async) and `resolveGfmTargetSync()` (sync) duplicate ~180 lines of identical guard logic, URL decoding, file resolution, and fallback handling. The only difference is Stage 4: async uses `IndexCache.get()` (which includes HTML anchors via `vault.read()`), sync uses `buildDocumentIndex()` directly on the metadata cache.

**Implementation:**

1. Extract shared Stages 1–3 and Stage 5 into private helper functions:

   ```typescript
   function guardGfmSlug(rawSlug: string): string | null {
       if (!isGfmSlug(rawSlug)) return null;
       try { return decodeURIComponent(rawSlug); } catch { return rawSlug; }
   }

   function resolveTargetFile(
       plugin: GfmHeadingLinksPlugin,
       notePath: string,
       sourcePath: string
   ): TFile | null {
       if (notePath === "") {
           const f = plugin.app.vault.getAbstractFileByPath(sourcePath);
           return f instanceof TFile ? f : null;
       }
       return plugin.app.metadataCache.getFirstLinkpathDest(notePath, sourcePath);
   }
   ```

2. Refactor `resolveGfmTarget()` to use the shared helpers and focus on the async Stage 4 (IndexCache → DocumentIndex with HTML anchors).
3. Refactor `resolveGfmTargetSync()` to use the same shared helpers and focus on the sync Stage 4 (metadata cache → `buildDocumentIndex()` without HTML anchors).
4. Both functions remain as the public API (same signatures), but their bodies shrink from ~90 lines each to ~30 lines each.

**Files to touch:** `src/resolve-target.ts`.

**Verification:** `npm test` passes all existing `resolve-target.test.ts` cases. `npm run build` succeeds. Click navigation and hover preview work identically to pre-refactoring. Line count of `resolve-target.ts` decreases by ~100 lines.

### TASK-1013: Migrate Settings Tab to Declarative `getSettingDefinitions()` API [DONE]

**Depends on:** TASK-1003 (existing settings tab). **Parallel with:** TASK-1010, TASK-1011. **Objectives:** [OBJ-020](objectives.md#v13-code-quality-objectives--second-review-pass).

Replace the legacy imperative `display()` API in `GfmSettingsTab` with the declarative `getSettingDefinitions()` API available since Obsidian 1.13.0. The declarative API handles save/load wiring automatically and enforces Obsidian's settings UI style guide.

**Current issues with the imperative approach:**

- Manual `onChange` → `this.plugin.saveSettings()` wiring for each control.
- Manual `containerEl.empty()` and DOM construction.
- Violates style guide: `containerEl.createEl("h2", { text: "GFM Heading Links" })` — plugin-name headings are forbidden (the sidebar tab title already names the plugin).
- Violates style guide: `addText()` uses `setPlaceholder("e.g. §")` — placeholder text should be sentence case.

**Implementation:**

1. Replace the `display()` method with `getSettingDefinitions()`:

   ```typescript
   getSettingDefinitions() {
       return [
           {
               name: "Link prefix",
               desc: "Character prepended to the GFM slug during autocomplete. Example: § produces [[Note#§my-heading]]. Leave empty for no prefix.",
               control: {
                   type: "text",
                   key: "prefix",
                   placeholder: "e.g. §",
               },
           },
           {
               name: "Link suffix",
               desc: "Character appended to the GFM slug during autocomplete. Example: ¶ produces [[Note#my-heading¶]]. Leave empty for no suffix.",
               control: {
                   type: "text",
                   key: "suffix",
                   placeholder: "e.g. ¶",
               },
           },
       ];
   }
   ```

2. Remove the `display()` method, the `containerEl.createEl("h2")` heading, and the `containerEl.createEl("p")` description paragraph. The description text should move to `desc` on each control or be omitted (the plugin's README is the appropriate place for explanatory prose).
3. Remove the manual `import { Setting }` if no longer needed.
4. Verify `minAppVersion` in `manifest.json` is ≥1.13.0 (required for declarative API). If supporting older versions, implement the [dual-support pattern](https://docs.obsidian.md/Plugins/Guides/Migrate+to+declarative+settings#Path+B:+dual+support).

**Files to touch:** `src/settings.ts`, `manifest.json` (verify `minAppVersion`).

**Verification:** Open Obsidian Settings → GFM Heading Links tab. Verify prefix/suffix fields render and persist correctly. Verify no plugin-name heading appears at the top. `npm run build` succeeds. `npx tsc --noEmit` passes.

---

## Phase 11: v2 — HTML Anchor Support (Deferred)

**Cycles:** Independent. Requires multi-layer architecture changes across click interception, reveal mechanism, and possibly CodeMirror-level event handling. Investigation plans preserved in `task-bugs.md`.

### TASK-0802: Toggle Setting for HTML Anchors [DEFERRED — v2]

The plugin can already parse `<a id="...">` HTML tags in the DocumentIndex. Expose a toggle in the settings tab (from TASK-1003) to enable/disable HTML anchor resolution. **Deferred to v2 — HTML anchor click/hover support must be solved first.**

### TASK-0803: Investigate & Fix HTML Anchor Click in Source/Live Preview [DEFERRED — v2]

**Depends on:** TASK-0401, TASK-0301. **Bug:** [Bug 5](task-bugs.md#5-html-anchor-click-only-works-in-reading-mode--deferred-to-v2).

HTML anchor links only resolve in Reading mode. Investigation plan preserved in task-bugs.md. **Deferred to v2.**

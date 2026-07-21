---
title: "Files & Risks"
tags: [architecture, plan, files, risks]
description: "15 files expected to change (new and modified) and 6 risk mitigations for the GFM Heading Links redesign."
date_created: 2026-07-08
date_changed: 2026-07-18
author: ["Lucas Galdino", "GitHub Copilot"]
plan_version: "2.0"
parent: "[[plan.md]]"
---

# Files & Risks

> Extracted from [`plan.md`](./plan.md). See [`objectives.md`](objectives.md) for architecture decisions, [`design.md`](design.md) for internals, and [`tasks.md`](tasks.md) for implementation order.

## Files expected to change

Each file maps to the [task](tasks.md) that creates or modifies it.

| File | Change |
|---|---|
| `main.ts` | **v1.2:** Rewrite: instantiate IndexCache, register vault events, wire three monkeypatches, store teardowns. **v1.3 (TASK-1007 ✓):** Updated to import `applyClickPatch` + `applyHoverPatch` from split files. |
| `src/gfm-slugify.ts` | **v1.2:** Keep `gfmSlugify()`. Remove `resolveGfmSlug()`. **v1.3 (TASK-1004 ✓):** Added `isGfmSlug()` — shared guard predicate with 6 unit tests. |
| `src/patch-workspace.ts` | **v1.2:** Rewrite `openLinkText` for line-number navigation. Update `hover-link` resolver. **v1.3 (TASK-1007 ✓):** **Deleted.** Split into `patch-link-click.ts` + `patch-link-hover.ts`. |
| `src/patch-link-click.ts` | **Created (v1.3, TASK-1007 ✓).** `applyClickPatch()` — `openLinkText` interceptor. Uses async `resolveGfmTarget()` + `injectVirtualBlock()`. |
| `src/patch-link-hover.ts` | **Created (v1.3, TASK-1007 ✓).** `applyHoverPatch()` — `trigger('hover-link')` interceptor. Uses sync `resolveGfmTargetSync()` + `injectVirtualBlock()`. |
| `src/types.ts` | **v1.2 (was `link-target.ts`):** `HeadingAnchorTarget`, `DocumentIndex`, `HtmlAnchorTarget`, `AnchorTarget`, `ResolutionResult` types. **v1.3 (TASK-1008 ✓):** Renamed from `link-target.ts`. All 5 imports updated. |
| `src/virtual-block.ts` | **Created (v1.3, TASK-1006 ✓).** `injectVirtualBlock()` + `VIRTUAL_BLOCK_CLEANUP_MS = 1500`. Shared by click + hover handlers. |
| `src/document-index.ts` | **v1.2:** `buildDocumentIndex()`, `scanHtmlAnchors()`. **v1.3 (TASK-1009 ✓):** Replaced O(n²) nested loop with O(n) 2-pass stack-based section boundary algorithm. |
| `src/index-cache.ts` | **v1.2:** `IndexCache` class with lazy build + invalidation. |
| `src/resolve-target.ts` | **v1.2:** `resolveGfmTarget()` — guard + file resolution + index lookup. **v1.3 (TASK-1004 ✓, TASK-1005 ✓):** Guard now uses `isGfmSlug()`. Added `resolveGfmTargetSync()` for hover handler. Bug fixed: inverted guard condition. |
| `src/reveal-target.ts` | **New.** `revealTargetLine()` — preview, source, and fallback. |
| `src/patch-editor-suggest.ts` | **v1.2:** `applyEditorSuggestPatches()` + `resolveGfmSlug()`. **v1.3 (TASK-1010 ✓):** Extracted `transformSuggestion()` pure mutation pipeline (4-step: HTML strip → slug resolve → wikilink alias → affix apply). `selectSuggestion` wrapper reduced from ~100 lines to ~10 lines. |
| `src/debug.ts` | **New.** `debugLog()` with enable flag. |
| `src/settings.ts` | **New (v1.3).** `GfmSettingsTab` extending `PluginSettingTab`. Stores prefix/suffix settings. |
| `package.json` | Add `vitest`, add `"test"` script. |
| `README.md` | Update architecture explanation. |
| `CHANGELOG.md` | Document architecture change. |
| `LICENSE` | **New (v1.3 release prep).** MIT license for community directory submission. |
| `.github/workflows/release.yml` | **New (v1.3 release prep).** GitHub Actions workflow — auto-builds `main.js` on tag push, creates draft GitHub Release with binary attachments. |
| `.gitignore` | **Updated (v1.3 release prep).** Added `data.json`, `*.png` exclusions. Refined `.github/` and `.agents/` patterns. |
| `docs/plan/*.md` | **Plan files.** `plan.md` (overview), `objectives.md` (8 objectives + architecture decisions), `design.md` (workflows + 5-layer architecture), `tasks.md` (8 phases, 30+ tasks), `validation.md` (validation matrix + debug events), `files.md` (changed files + risk mitigations), `task-bugs.md` (bug tracker). |

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `applyScroll(line, {highlight})` removed in future Obsidian | Highlight stops working | Runtime guard → one-arg fallback → manual `is-flashing` toggle. |
| Same-file `openLinkText("", sourcePath)` causes flicker | Visible blink on same-file links | **Mitigated:** Used `#^virtual-id` shortcut without file path for same-file links. |
| `generateMarkdownLink` signature changes | Build breaks | Wrapper uses `...rest` passthrough. |
| Cache stale after external modification | Wrong target line | Vault events cover Obsidian-triggered changes. External changes trigger modify too. |
| Mobile lacks `previewMode.applyScroll` | Runtime error | `applyScroll` is part of `MarkdownSubView`, implemented by both desktop and mobile. |
| Unicode `\p{L}\p{N}` requires ES2018+ | Older builds crash | Obsidian's minimum runtime supports ES2018 (Electron 25+). |

---
title: "Files & Risks"
tags: [architecture, plan, files, risks]
description: "15 files expected to change (new and modified) and 6 risk mitigations for the GFM Heading Links redesign."
date_created: 2026-07-08
date_changed: 2026-07-10
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
| `main.ts` | Rewrite: instantiate IndexCache, register vault events, wire three monkeypatches, store teardowns. |
| `src/gfm-slugify.ts` | Keep `gfmSlugify()`. Remove `resolveGfmSlug()`. |
| `src/patch-workspace.ts` | Rewrite `openLinkText` for line-number navigation. Update `hover-link` resolver. |
| `src/link-target.ts` | **New.** `HeadingAnchorTarget`, `DocumentIndex`, `HtmlAnchorTarget`, `AnchorTarget`, `ResolutionResult` types. |
| `src/document-index.ts` | **New.** `buildDocumentIndex()`, `scanHtmlAnchors()`. |
| `src/index-cache.ts` | **New.** `IndexCache` class with lazy build + invalidation. |
| `src/resolve-target.ts` | **New.** `resolveGfmTarget()` — guard + file resolution + index lookup. |
| `src/reveal-target.ts` | **New.** `revealTargetLine()` — preview, source, and fallback. |
| `src/patch-editor-suggest.ts` | **New.** `applyEditorSuggestPatches()` — monkeypatches `EditorSuggest.selectSuggestion` to mutate `value.subpath` to GFM slug before native insertion. Includes `resolveGfmSlug()` for duplicate-heading occurrence matching via dropdown index. |
| `src/debug.ts` | **New.** `debugLog()` with enable flag. |
| `package.json` | Add `vitest`, add `"test"` script. |
| `README.md` | Update architecture explanation. |
| `CHANGELOG.md` | Document architecture change. |
| `docs/plan/*.md` | **Plan files.** `plan.md` (overview), `objectives.md` (8 objectives + architecture decisions), `design.md` (workflows + 5-layer architecture), `tasks.md` (7 phases, 24+ tasks), `validation.md` (validation matrix + debug events), `files.md` (changed files + risk mitigations), `task-bugs.md` (bug tracker). |

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `applyScroll(line, {highlight})` removed in future Obsidian | Highlight stops working | Runtime guard → one-arg fallback → manual `is-flashing` toggle. |
| Same-file `openLinkText("", sourcePath)` causes flicker | Visible blink on same-file links | **Mitigated:** Used `#^virtual-id` shortcut without file path for same-file links. |
| `generateMarkdownLink` signature changes | Build breaks | Wrapper uses `...rest` passthrough. |
| Cache stale after external modification | Wrong target line | Vault events cover Obsidian-triggered changes. External changes trigger modify too. |
| Mobile lacks `previewMode.applyScroll` | Runtime error | `applyScroll` is part of `MarkdownSubView`, implemented by both desktop and mobile. |
| Unicode `\p{L}\p{N}` requires ES2018+ | Older builds crash | Obsidian's minimum runtime supports ES2018 (Electron 25+). |

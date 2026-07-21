---
title: "Changelog"
tags: [changelog, gfm-heading-links, obsidian-plugin]
description: "Release history and notable changes for the GFM Heading Links Obsidian plugin"
date_created: 2026-07-02
date_changed: 2026-07-03
author: "Lucas Galdino"
---

# Changelog

All notable changes to the GFM Heading Links plugin are documented in this file.

The format is based on [Keep a Changelog][keepachangelog], and this project adheres to
[Semantic Versioning][semver].

[keepachangelog]: https://keepachangelog.com/en/1.1.0/
[semver]: https://semver.org/spec/v2.0.0.html

## [1.2.0][] — 2026-07-13

### Added

- **Document Index Architecture**: Lightweight background `Map<gfmSlug, AnchorTarget>` per file, separate from Obsidian's cache. Enables O(1) slug lookups with zero risk of cache contamination.
- **Virtual Block Injection**: Temporarily injects `#^gfm-click-{slug}` blocks into `cache.blocks` to leverage Obsidian's native block-level scrolling and `.is-flashing` highlight — works correctly for duplicate headings.
- **Autocomplete GFM Slug Output** (`EditorSuggest.selectSuggestion`): Selecting a heading from the `[[` dropdown now outputs the GFM slug (e.g., `[My Heading](file.md#my-heading)`) while preserving the original heading text as the alias.
- **Duplicate Heading Resolution in Autocomplete**: Advanced dropdown occurrence-index matching correctly resolves which Nth duplicate was selected, producing the correct collision suffix (`-1`, `-2`, etc.).
- **HTML Anchor Scanning** (`scanHtmlAnchors`): Parses `<a id="...">` and `<a name="...">` tags for target identification (click navigation in Reading mode).
- **Structured Debug Logging** (`src/debug.ts`): 15 event types with `DEBUG_ENABLED` toggle for development instrumentation.
- **Unit Tests** (Vitest, 17 tests): `gfmSlugify` (basic, Unicode, edge cases), `buildDocumentIndex` (collision suffixes, endLine), `resolveGfmTarget` (guard logic).

### Changed

- **Architectural Shift**: Abandoned the speculative `Heading#Heading` subpath navigation. Replaced with Document Index + Virtual Block Injection across all three monkeypatches (`openLinkText`, `trigger('hover-link')`, `EditorSuggest.selectSuggestion`).
- **Same-file navigation**: Bypassed native resolution for same-file links to eliminate jump-to-top flicker.
- **HTML in heading aliases**: Autocomplete now strips HTML tags from heading text (e.g., `## Title <a id="x"></a>` → alias `Title`).

### Fixed

- **Hover Preview on duplicate headings**: Corrected `buildDocumentIndex(cache.headings)` → `buildDocumentIndex(cache)` — the former produced an empty index, causing all hover previews to fail.
- **Alias loss in autocomplete**: Stopped mutating `value.heading` — only `value.subpath` is rewritten to the GFM slug.
- **`.is-flashing` on duplicates**: Native block navigation handles section highlighting correctly, no longer highlights wrong heading.

### Known Limitations

- HTML anchor click navigation works only in Reading mode (Live Preview / Source mode under investigation — see Bug 10).
- HTML anchor hover preview is not yet supported (hover interceptor only handles heading-type targets — see Bug 6).
- GFM collision suffix uses last-write-wins (`Map.set()` overwrites). First-occurrence priority deferred to v2 (see Bug 8).
- `DEBUG_ENABLED = true` on dev branch — set to `false` for production builds.

## [1.1.0][] — 2026-07-03

### Changed

- **Architectural Overhaul:** Completely abandoned the fragile CodeMirror 6 `ViewPlugin` and DOM `MutationObserver` architecture. The plugin now globally monkeypatches Obsidian's core `Workspace` router (`workspace.openLinkText` and `workspace.trigger('hover-link')`).
- **Fixed `Ctrl + Hover` (Page Preview):** Because the plugin now patches the event routing layer rather than aggressively swallowing DOM `mouseover` events, Obsidian's native modifier-key detection and delays work perfectly.
- **Fixed Cross-File Links:** Addressed a critical bug where links pointing to other files (e.g., `[Link](other-file.md#gfm-slug)`) were ignored. The new router patch correctly separates the file path from the hash before attempting resolution.

### Removed

- Deleted `src/editing-mode.ts` (CM6 extensions were unnecessary).
- Deleted `src/reading-mode.ts` (DOM Mutation Observers were unnecessary).
- Deleted `src/hover-panel.ts` (Custom event propagation blocking was actively breaking native behavior).

## [1.0.0][] — 2026-07-02

### Refactored

- **Monolith split into `src/` modules.** The 260-line `main.ts` was decomposed into three
  focused source files under `src/`, leaving `main.ts` as a thin 13-line entry point:

  | Module | Responsibility |
  | --- | --- |
  | `src/gfm-slugify.ts` | Pure utility functions — `gfmSlugify()` and `resolveGfmSlug()` |
  | `src/reading-mode.ts` | Reading view — `registerMarkdownPostProcessor` + `MutationObserver` fallback |
  | `src/editing-mode.ts` | Source mode & Live Preview — CM6 `ViewPlugin` with mousedown intercept |

- **`tsconfig.json`** updated to include `src/**/*.ts` alongside the existing `main.ts` entry.

> [!note]
> No behavioral changes were introduced. The plugin logic is structurally identical to the
> pre-refactor version. The reading-view path (post-processor + MutationObserver) is known to
> work; the editing-mode path (CM6 ViewPlugin) requires further debugging — see
> [failed-logic.md](failed-logic.md) and [starting-point.md](starting-point.md).

### Changed

- `resolveGfmSlug` now lives in `src/gfm-slugify.ts` and uses a mixed import
  (`{ type Plugin, TFile }`) because `TFile` is checked via `instanceof` at runtime.
- `registerReadingMode(plugin)` replaces the inline post-processor and observer setup.
- `createEditingModeExtension(plugin)` replaces the inline `ViewPlugin.fromClass(...)` constructor.

### Removed

- No code was removed — all logic was relocated to the appropriate `src/` module.

---

## [0.1.0][] — 2026-07-01

### Added

- Initial plugin structure: `main.ts`, `manifest.json`, `package.json`, `tsconfig.json`,
  `esbuild.config.mjs`, `versions.json`.
- GFM-style heading slug resolution via `gfmSlugify()` and `resolveGfmSlug()`.
- Reading-view link rewriting through `registerMarkdownPostProcessor`.
- Reading-view fallback via `MutationObserver` for dynamically-added `.internal-link` elements.
- Editing-mode (Source & Live Preview) link interception via a CM6 `ViewPlugin.fromClass`
  extension that captures mousedown events.

[1.2.0]: https://github.com/user/obsidian-gfm-headers/releases/tag/1.2.0
[1.1.0]: https://github.com/user/obsidian-gfm-headers/releases/tag/1.1.0
[1.0.0]: https://github.com/user/obsidian-gfm-headers/releases/tag/1.0.0
[0.1.0]: https://github.com/user/obsidian-gfm-headers/releases/tag/0.1.0

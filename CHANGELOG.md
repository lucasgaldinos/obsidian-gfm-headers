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

[1.1.0]: https://github.com/user/obsidian-gfm-headers/releases/tag/1.1.0
[1.0.0]: https://github.com/user/obsidian-gfm-headers/releases/tag/1.0.0
[0.1.0]: https://github.com/user/obsidian-gfm-headers/releases/tag/0.1.0

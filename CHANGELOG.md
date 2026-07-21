---
title: "Changelog"
tags: [changelog, gfm-heading-links, obsidian-plugin]
description: "Release history and notable changes for the GFM Heading Links Obsidian plugin"
date_created: 2026-07-02
date_changed: 2026-07-18
author: "Lucas Galdino"
---

# Changelog

All notable changes to the GFM Heading Links plugin are documented in this file.

The format is based on [Keep a Changelog][keepachangelog], and this project adheres to
[Semantic Versioning][semver].

[keepachangelog]: https://keepachangelog.com/en/1.1.0/
[semver]: https://semver.org/spec/v2.0.0.html

## [1.3.7][] — 2026-07-21

### Fixed

- **Community review: ESLint fatal error** — `minAppVersion` in `manifest.json` was `"1.12"`
  (invalid semver — missing `.0` patch). The `eslint-plugin-obsidianmd` `no-unsupported-api`
  rule calls `new SemVer("1.12")` which throws `TypeError: Invalid Version`, crashing ESLint
  entirely. Fixed to `"1.0.0"` (the plugin only uses APIs available since Obsidian 0.12.0).
- **`versions.json`** — added missing entry `"1.3.7": "1.0.0"` so older Obsidian clients
  can fall back to a compatible plugin version.
- **Sentence case in legacy settings UI** (`src/settings.ts`): Fixed 5 `obsidianmd/ui/sentence-case`
  warnings in the `display()` fallback. "GFM" → "gfm", "Note" → "note", "e.g." → "E.g."
- **README compatibility statement**: Corrected "Requires Obsidian ≥ 1.12.7" → "Requires
  Obsidian ≥ 1.0.0" to match the actual minimum API requirements.

### Added

- **ESLint configuration** (`eslint.config.mjs`): Mirrors
  [obsidian-sample-plugin](https://github.com/obsidianmd/obsidian-sample-plugin)'s setup
  with `eslint-plugin-obsidianmd` for Obsidian-specific rules. Run `npm run lint` to
  validate before submitting to the community directory.
- **`npm run lint`** script: Runs ESLint against `main.ts` and `src/*.ts`.

## [1.3.1][] — 2026-07-20

> **Note:** This release consolidates the original v1.3.1 release infrastructure work and all
> subsequent community review compliance fixes (previously spread across v1.3.2–1.3.6).
> Those intermediate releases have been deleted — this is the definitive v1.3.1.

### Added

- **Release Infrastructure**: `LICENSE` (MIT), GitHub Actions release workflow
  (`.github/workflows/release.yml`), branch strategy (`main`=production/DEBUG_ENABLED=false,
  `dev`=development/DEBUG_ENABLED=true).
- **CI Artifact Attestations** (`actions/attest@v4`): Supply-chain provenance for release
  artifacts.
- `author` and `authorUrl` populated in `manifest.json`.
- `.gitignore` hardened: `data.json`, `*.png` exclusions, refined `.github/` and `.agents/`
  patterns.
- **Typed Internal APIs** (`src/vault-config.ts`): `getVaultConfig()` and `isWikilinksEnabled()`
  helpers replace inline `(vault as any)` casts.
- **Type-Safe Editor Suggest**: `SuggestionValue`, `EditorSuggestInstance`,
  `SuggestionDropdownItem` interfaces and `unwrapDropdownItem()` type guard — all `any`
  types eliminated from the suggest pipeline.

### Changed

- `package.json` version aligned with `manifest.json` (both `1.3.1`).
- All documentation updated: `docs/plan/*`, `docs/research/architectural-history.md`,
  `docs/architecture.md`, `README.md`.
- Release links in `CHANGELOG.md` fixed to point to `lucasgaldinos/obsidian-gfm-headers`.
- **Production console hygiene**: `console.log` → `console.debug` in gated debug system
  (`src/debug.ts`). `console.debug` is suppressed by default in browser DevTools at the
  default "Info" log level.
- **Arrow functions for all monkeypatch assignments**: `workspace.openLinkText`,
  `workspace.trigger`, and `suggest.selectSuggestion` all use arrow functions with
  explicit `.call(workspace, ...)` rebinding.
- **`.bind(workspace)` at method capture**: `originalOpenLinkText` and `originalTrigger`
  are bound at capture time via `.bind(workspace)`, eliminating `this`-scoping warnings
  from Obsidian's review linter.
- **Safe array initialization**: `new Array<number>(n).fill(0)` replaces `new Array(n).fill(0)`
  to avoid implicit `any[]` inference.
- `window.setTimeout` / `window.clearTimeout` used instead of bare `setTimeout` /
  `clearTimeout` for browser global compliance.
- `loadData()` cast as `Partial<GfmSettings>` instead of `as any`.
- `view.currentMode` cast as typed interface instead of `as any`.
- `injectVirtualBlock` and `selectSuggestion` use typed `Pos` and `SuggestionValue` params.

### Removed

- Accidentally committed `image.png`, `image copy.png`, and `data.json`.
- All `eslint-disable` and `@typescript-eslint/no-explicit-any` directive comments.
- Unused `debugLog` / `DEBUG_ENABLED` import from `main.ts`.
- Non-existent `styles.css` from CI release assets.

### Fixed

- **`this: void` linter warnings**: Original methods captured from `workspace` are now
  bound via `.bind(workspace)` at capture time, preventing `this`-scoping errors when
  the method is called detached from its object.
- **Review linter compliance**: Addressed all warnings reported by Obsidian's automated
  plugin review — no `any` types, no `console.log` in production builds, no directive
  suppressions, no `function()` without `this: void`.

## [1.3.0][] — 2026-07-17

### Added

- **Settings Tab**: Configurable prefix and suffix characters for autocompleted links (e.g., `§Heading¶`). Dual-API support: uses declarative `getSettingDefinitions()` on Obsidian 1.13.0+, falls back to `display()` on older versions.
- **Wikilink Alias Auto-Injection**: When Obsidian is using wikilinks (`[[`), selecting a heading from autocomplete now automatically appends `|Original Heading` — producing `[[#gfm-slug|Original Heading]]` instead of bare `[[#gfm-slug]]`.
- **Link Affixes**: User-configurable prefix/suffix applied to heading aliases during autocomplete.
- `isGfmSlug()` shared guard predicate in `gfm-slugify.ts`.
- `transformSuggestion()` pure pipeline extracting heading mutation logic from `selectSuggestion` god-function.
- `decodeGfmSlug()` and `resolveTargetFile()` shared resolution helpers.
- `injectVirtualBlock()` shared utility with cleanup callback and `VIRTUAL_BLOCK_CLEANUP_MS` constant.
- `normalizeSlug()` in `src/link-parse.ts`.

### Changed

- `patch-workspace.ts` split by SRP into `patch-link-click.ts` (`applyClickPatch`, async) and `patch-link-hover.ts` (`applyHoverPatch`, sync).
- `buildDocumentIndex()` replaced O(n²) nested loop with 2-pass O(n) stack-based algorithm.
- `link-target.ts` renamed to `types.ts` — all 5 imports updated.
- Variable renames for readability: `data` → `hoverEventPayload`, `value` → `suggestionValue`, `mutated` → `didModifySubpath`.
- `resolveGfmTarget()` and `resolveGfmTargetSync()` unified to use shared `decodeGfmSlug()` + `resolveTargetFile()` helpers, reducing each from ~90 to ~15 lines.
- Hover handler no longer uses `require("./document-index")` inlining — delegates to `resolveGfmTargetSync()`.
- Settings tab uses declarative `getSettingDefinitions()` API (Obsidian 1.13.0+) with `display()` fallback.
- `minAppVersion` set to `1.12.7` for dual settings API support.
- `DEBUG_ENABLED = true` on dev branch — set to `false` for production builds.

### Fixed

- **Inverted guard bug**: `isGfmSlug()` condition was inverted in `resolve-target.ts`, causing valid GFM slugs to pass through unresolved.
- **Settings tab broken on Obsidian <1.13.0**: Declarative-only API caused empty settings pane. Fixed with dual-API support.
- **Affixes applied to wrong field**: Affixes were appended to `suggestionValue.subpath` (the slug) instead of `suggestionValue.heading` (the alias).
- **Wikilink alias not injected**: Multiple iterations required; finally resolved via `plugin.app.workspace.activeEditor?.editor` post-insertion modification.

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
> work; the editing-mode path (CM6 ViewPlugin) was later replaced by the workspace-level
> monkeypatch architecture in v1.1.0.

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

[1.3.7]: https://github.com/lucasgaldinos/obsidian-gfm-headers/releases/tag/1.3.7
[1.3.1]: https://github.com/lucasgaldinos/obsidian-gfm-headers/releases/tag/1.3.1
[1.3.0]: https://github.com/lucasgaldinos/obsidian-gfm-headers/releases/tag/1.3.0
[1.2.0]: https://github.com/lucasgaldinos/obsidian-gfm-headers/releases/tag/1.2.0
[1.1.0]: https://github.com/lucasgaldinos/obsidian-gfm-headers/releases/tag/1.1.0
[1.0.0]: https://github.com/lucasgaldinos/obsidian-gfm-headers/releases/tag/1.0.0
[0.1.0]: https://github.com/lucasgaldinos/obsidian-gfm-headers/releases/tag/0.1.0

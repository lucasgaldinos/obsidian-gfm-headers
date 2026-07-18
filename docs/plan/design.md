---
title: "Design: How It Works"
tags: [architecture, plan, design, internals]
description: "5-layer architecture, data flows, design decisions, and known limitations."
date_created: 2026-07-08
date_changed: 2026-07-16
author: ["Lucas Galdino", "GitHub Copilot"]
plan_version: "2.0"
parent: "[[plan.md]]"
---

# Design: How It Works

> See [`objectives.md`](objectives.md) for why, [`tasks.md`](tasks.md) for build order, [`validation.md`](validation/validation.md) for test coverage.
>
> **v1.3 (complete):** All 9 tasks done — 6 code quality refactoring + settings tab + wikilink alias + link affixes. See [Phase 10](tasks.md#phase-10-v13--code-quality-refactoring--settings--wikilink-alias).

## 1. Architecture Overview

The plugin uses a **5-layer architecture** with complementary interception points:

| Layer | Module | Intercepts | Mechanism |
|---|---|---|---|
| 1. Document Indexer | `document-index.ts`, `index-cache.ts` | (background) | Lazy `Map<gfmSlug, AnchorTarget>` per file, separate from Obsidian's cache |
| 2. Router | `patch-link-click.ts` (`openLinkText`) | Click / programmatic navigation | Virtual Block Injection (`#^gfm-click-{slug}`) → native scroll + highlight |
| 3. Autocomplete | `patch-editor-suggest.ts` (`EditorSuggest.selectSuggestion`) | Link creation dropdown | Mutates `value.subpath` to GFM slug before native insertion |
| 4. Hover Preview | `patch-link-hover.ts` (`trigger('hover-link')`) | Page Preview hover | Sync resolution via `resolveGfmTargetSync()` + Virtual Block Injection |
| 5. Reveal Fallback | `reveal-target.ts` | Non-heading targets (HTML anchors) | `setEphemeralState` + `applyScroll(line, {highlight})` |
| — Shared VBI | `virtual-block.ts` | (utility) | `injectVirtualBlock()` — single source for block injection + cleanup |

**Key principle:** All layers feed from the same `DocumentIndex` (built from `MetadataCache.headings` + `scanHtmlAnchors()`), cached by `IndexCache`, invalidated on vault events. No Obsidian cache contamination.

### Related Obsidian APIs

- [`MetadataCache.getFileCache()`](<file:///home/lucas_galdino/.agents/plugins/obsidian-plugin/skills/obsidian-plugins/references/Reference/TypeScript%20API/MetadataCache.md>) — source of heading data. NOT monkeypatched.
- [`Workspace.openLinkText()`](<file:///home/lucas_galdino/.agents/plugins/obsidian-plugin/skills/obsidian-plugins/references/Reference/TypeScript%20API/Workspace.md>) — the router we intercept for clicks.
- [`EditorSuggest.selectSuggestion()`](<file:///home/lucas_galdino/.agents/plugins/obsidian-plugin/skills/obsidian-plugins/references/Reference/TypeScript%20API/EditorSuggest.md>) — autocomplete we intercept for link creation.
- [`resolveSubpath()`](<file:///home/lucas_galdino/.agents/plugins/obsidian-plugin/skills/obsidian-plugins/references/Reference/TypeScript%20API/resolveSubpath.md>) — Obsidian's native heading resolver (cannot be patched — module exports are read-only).
- [`HoverPopover`](<file:///home/lucas_galdino/.agents/plugins/obsidian-plugin/skills/obsidian-plugins/references/Reference/TypeScript%20API/HoverPopover.md>) — Page Preview component. Expects immutable cache state.

---

## 2. Core Data Flows

### 2.1 Click Navigation (`openLinkText` interceptor)

**How Obsidian natively works (unpatched):**
Obsidian expects exact-case OFM strings like `Note.md#My Heading`. If fed a lowercase GFM slug, `resolveSubpath` completely fails to find the heading.

#### 2.1.1 Unpatched (Native Obsidian) Flow

*(Note: Obsidian's native flow expects exact-case OFM strings like `Note.md#My Heading`. If fed a lowercase GFM slug, it completely fails to find the heading).*

1. User clicks a link or `openLinkText("Note.md#my-heading")` is called.
2. Obsidian resolves `Note.md` and opens it in a leaf.
3. Obsidian calls the exported `resolveSubpath` function to find the block/heading string.
4. Obsidian sets an ephemeral state (`setEphemeralState({line: X})`) on the active view.
5. The view's renderer observes this and calls `applyScroll(line, {highlight: true})`, which scrolls and triggers the CSS `.is-flashing` animation.

#### 2.1.2 Patched Flow (v1 — replaced by New Flow below in v1.2.0)

> [!note] Historical: this was the v1 approach, replaced in v1.2.0 by Virtual Block Injection.

1. User clicks a GFM link (`Note.md#my-heading-1`).
2. `patch-workspace.ts` intercepts `openLinkText`.
3. The plugin calculates that `#my-heading-1` maps to the 2nd duplicate of "My Heading".
4. It rewrites the link to Obsidian's undocumented syntax: `Note.md#My Heading#My Heading`.
5. It passes this rewritten string to the original `openLinkText`.

### 2.2 Current implementation (v1.2.0)

```
openLinkText("Note.md#commands-1", sourcePath, ...rest) intercepted
  → parse <function-name>: extract notePath + slug
  → guard: is GFM slug? If not → passthrough to original
  → resolveGfmTarget(plugin, notePath, slug, sourcePath)
  → if not resolved → pass through to original (let Obsidian handle natively)
  → if resolved (Heading):
      → Virtual Block Injection: temporarily add section position to `cache.blocks`
      → newLinktext = notePath ? `${notePath}#^gfm-click-${slug}` : `#^gfm-click-${slug}`
      → call original openLinkText(newLinktext, sourcePath, ...rest)
        ↑ Native Obsidian handles block navigation, scrolling, and full-section highlighting
      → clean up virtual block after 1500ms
  → if resolved as HTML Anchor (fallback):
      → open file without hash via original openLinkText
      → revealTargetInView(view, target) — manual scroll + highlight
```

**Historical (v1 — replaced):** The old `#Heading#Heading` subpath format was speculative. Obsidian's `resolveSubpath` doesn't understand it. Replaced by Virtual Block Injection in v1.2.0.

### 2.2 Hover Preview (`trigger('hover-link')` interceptor)

1. `workspace.trigger` is called with `"hover-link"` event.
2. Interceptor extracts slug from `hoverEventPayload.linktext`, applies GFM guard via `isGfmSlug()`.
3. Calls `resolveGfmTargetSync()` — synchronous variant using only metadata cache (no disk I/O, no HTML anchors).
4. For heading targets: calls `injectVirtualBlock()` from `virtual-block.ts`, rewrites `hoverEventPayload.linktext` to `#^gfm-{slug}`, then calls `originalTrigger`.
5. For HTML anchor targets: silently skipped (hover interceptor only handles `type: "heading"`). See [Bug 6](task-bugs.md#6-html-anchor-hover-inconsistency).
6. Virtual block auto-cleaned after `VIRTUAL_BLOCK_CLEANUP_MS` (1500ms) via cleanup callback.

### 2.3 Autocomplete (`EditorSuggest.selectSuggestion` interceptor)

1. User types `[[#` — Obsidian shows heading suggestions.
2. User selects a heading — `selectSuggestion(value, evt)` is called.
3. Interceptor mutates `value.subpath` to the GFM slug (preserving `value.heading` as the alias).
4. For duplicate headings: uses dropdown position matching (`suggestInstance.chooser.values`) to determine which Nth occurrence was selected.
5. Original `selectSuggestion` is called with the mutated value — Obsidian natively inserts the link.

---

## 3. Design Decisions

### 3.1 Why a separate DocumentIndex (not monkeypatch `getFileCache`)?

`resolveSubpath(cache, subpath)` — the function Obsidian uses internally to match headings — is a standalone exported function. Module exports are read-only in javascript; we cannot replace it. The only way to influence `resolveSubpath` would be to monkeypatch `MetadataCache.prototype.getFileCache` to return modified data. This would feed altered cache data to every consumer: Outline, Graph, Backlinks, Search, autocomplete...

Outline panel would display GFM slugs instead of readable text, autocomplete would suggest slugs, Search would find slugs, and other plugins could break in unpredictable ways. By keeping our own separate DocumentIndex, we achieve zero risk of side effects.

**Internal evidence** (from decompiled Obsidian `app.js`): `resolveSubpath` (function `FT`) accesses only named properties: `cache.headings`, `cache.blocks`, `cache.footnotes`, `cache.listItems`. It does NOT iterate over object keys. This means adding a new property to the cache object (like `gfmLinks`) would be invisible to `resolveSubpath`. However, the separate `DocumentIndex` approach is cleaner — no cache object modification at all.

### 3.2 Why map to exact line numbers?

Obsidian natively scrolls by extracting `start.line` from the result of `resolveSubpath` and feeding it to `applyScroll`. By mapping the GFM slug to the exact line number ourselves, we bypass the faulty `resolveSubpath` lookup and jump straight to the same `applyScroll` command Obsidian uses internally. The `endLine` (next heading) is preserved for correct heading span coverage, matching Obsidian's native behavior.

>[!tip] How `applyScroll` triggers highlighting internally (from decompiled Obsidian `app.js`)
>
>```ts
>e.prototype.applyScroll = function(e, t) {
>    var a = t || {}, s = a.highlight, l = a.center;
>    // ... scrolls to correct section/line ...
>    // ... finds target DOM element y (the <li>) ...
>    return s && this.highlightEl(y || p.el), !0
>}
>e.prototype.highlightEl = function(e) {
>    // 1. Remove is-flashing from ALL sections first
>    // 2. Add is-flashing to target element
>    // 3. setTimeout to remove it after X ms
>}
>```
>
>The `{highlight: true}` option is a real, parseable option inside `applyScroll` — not undocumented internal behavior. The only thing "missing" is typescript's type signature in `obsidian.d.ts` (which only declares `applyScroll(scroll: number): void`).

>[!tip]`PreviewRendererLike` — Type-safe access to the real `applyScroll` overload
>
>Since `obsidian.d.ts` does not declare the `{highlight, center}` overload, we define a local interface and use a runtime cast:
>
>```typescript
>/** Local interface matching the real applyScroll overload confirmed via decompiled app.js. */
>interface PreviewRendererLike {
>  applyScroll(line: number, options?: {
>    highlight?: boolean;
>    center?: boolean;
>  }): void;
>}
>
>// Usage in reveal-target.ts:
>const renderer = view.previewMode as unknown as PreviewRendererLike;
>renderer.applyScroll(target.line, { highlight: true });
>```
>
>This avoids scattering `any` casts throughout the codebase. If Obsidian ever adds this overload to `obsidian.d.ts`, we remove the local interface and use the official one.

### 3.3 Guard logic: GFM vs OFM detection

| Slug pattern | Classification | Action |
|---|---|---|
| `my-heading` (lowercase, hyphenated) | GFM | Resolve via DocumentIndex |
| `My Heading` (uppercase, spaces) | OFM | Passthrough to Obsidian |
| `my%20heading` (URL-encoded) | OFM | Passthrough[^obs-4a] |
| `^block-id` (starts with `^`) | Block ref | Passthrough[^obs-4b] |
| `[^footnote]` (starts with `[^`) | Footnote | Passthrough[^obs-4b] |

[^obs-4a]: >[!warning] problem on
    >Currently `my%20heading` is not being properly recognized. Only if wikilink `[[]]`.
    >
    >If `[]()`, it does activate hover-link debug.
    >
    >It also shows a problem in our current link testing approach.

[^obs-4b]: not tested if still working.

Conservative: false negatives (GFM treated as OFM) are acceptable. False positives (OFM treated as GFM) would BREAK native links.

### 3.4 Same-file navigation

One code path: always call `openLinkText` even for same-file links. Uses `#^virtual-id` shortcut without file prefix to avoid flicker/reloads. Preserves modifier keys (Ctrl+click → new tab).

### 3.5 Graph View and Backlinks

Unaffected. Obsidian natively parses `[Link](Note.md#my-heading)` and adds it to the outgoing `links` cache. These features only care about the file connection, not the heading format.

### 3.6 Architecture Design

1. **Document Indexer:** A lazy `DocumentIndex` that maps generated GFM slugs (and scanned HTML anchor IDs) to exact line numbers. Built from `MetadataCache.headings` (public API). Stored in a separate `Map` — no Obsidian cache contamination. → Implemented in [TASK-0103](tasks.md#task-0103-build-document-index-in-srcdocument-indexts), cached by [TASK-0106](tasks.md#task-0106-implement-srcindex-cachets).

2. **Router Monkeypatch (`openLinkText`):** Intercepts all click and programmatic navigation. For GFM links: resolves slug to line number, injects a temporary virtual block covering the full section into `cache.blocks`, calls original `openLinkText` targeting this block (`#^virtual-id`) to let Obsidian natively scroll and flash the entire section, then cleans up the cache. → [TASK-0401](tasks.md#task-0401-update-openlinktext-interceptor).

3. **Autocomplete Monkeypatch (`EditorSuggest.selectSuggestion`):** Intercepts link generation via autocomplete dropdowns. Instead of patching `generateMarkdownLink` (which proved ineffective for `EditorSuggest` interactions), we mutate the native suggestion `value` object (`value.subpath`) directly before text insertion. This outputs `[Heading](#gfm-slug)` natively, while flawlessly resolving duplicate headings. → [TASK-0404](tasks.md#task-0404-implement-generatemarkdownlink--editorsuggest-monkeypatch).

4. **Hover Monkeypatch (`trigger('hover-link')`):** Intercepts Page Preview requests. Uses `resolveGfmTargetSync()` (sync variant — metadata cache only, no disk I/O) to resolve the slug. Injects a temporary virtual block via `injectVirtualBlock()` from `virtual-block.ts`, rewrites the linktext, calls the original trigger so Obsidian's native preview renderer resolves it. Virtual block auto-cleaned after `VIRTUAL_BLOCK_CLEANUP_MS`. → [TASK-0403](tasks.md#task-0403-update-triggerhover-link-interceptor) + [TASK-1005](tasks.md#task-1005-unify-hover-link-resolution-with-indexcache-done) + [TASK-1006](tasks.md#task-1006-extract-shared-virtual-block-injection-utility-done).

5. **Reveal Layer (`revealTargetLine`):** Shared service for scrolling to a line. Handles Preview mode (`applyScroll` with highlight), Source mode (`Editor.setCursor` + `Editor.scrollIntoView`), and manual `is-flashing` CSS fallback. → [TASK-0301](tasks.md#task-0301-implement-srcreveal-targetts).

---

## 4. Implementation Details

### 4.1 `applyScroll` overload (undocumented)

Obsidian's `obsidian.d.ts` declares `applyScroll(scroll: number): void`, but the real implementation accepts `{highlight, center}` options (confirmed via decompiled `app.js`). We use a local `PreviewRendererLike` interface with runtime cast to avoid `any` scattered throughout the codebase.

### 4.2 Race conditions during async resolution

The `openLinkText` flow has an async boundary (`await resolveGfmTarget`). Mitigations:

- **User navigates away**: View-finding loop fails gracefully, file was already opened.
- **Rapid clicks**: Each spawns a separate async chain. `highlightEl` clears all existing `.is-flashing` before adding new one — only last target flashes.
- **Tab closed before reveal**: View-finding returns null, reveal skipped.

### 4.3 Map last-write-wins and collision suffixes

`buildDocumentIndex` uses `index.set(finalSlug, target)` — the LAST heading to produce a given slug overwrites earlier entries. This means `#commands-1` resolves to whichever heading produces that slug LAST in document order, not first. This is a known issue (see [Bug 8](task-bugs.md#8-gfm-collision-suffix-ambiguity-the-commands-problem)). A fix would be to check `index.has(finalSlug)` before `index.set()` to give first-occurrence priority.

---

## 5. Known Limitations

Discovered during Session 3 validation testing (2026-07-14/15). Cross-referenced with [task-bugs.md](task-bugs.md#session-3-validation-matrix-testing--2026-07-14).

### 5.1 HTML Anchor: Mode-Dependent Click + No Hover

**Bugs:** [#6](task-bugs.md#6-html-anchor-hover-inconsistency), [#10](task-bugs.md#10-html-anchor-click-only-works-in-reading-mode)

HTML anchors only work for click navigation in **Reading mode**. Live Preview and Source mode clicks fail. Hover preview never works for HTML anchors (hover interceptor only handles `type: "heading"`).

- **Standalone anchors** (on their own line): Click works. Hover not tested.
- **Anchors inside heading text** (`## Heading <a id="x"></a>`): The heading's GFM slug works for both click and hover. The anchor's `id` works for click but NOT hover — the hover interceptor only injects virtual blocks for `type: "heading"` targets, not `type: "html-anchor"`.
- **Anchors on the line before a heading**: Same pattern — anchor id works for click, fails for hover.

**Root cause:** The `hover-link` interceptor in `workspace.trigger` checks `target.type === "heading"` before injecting a virtual block. HTML anchor targets silently fall through without injection.

### 5.2 Editor Suggest Preserves Raw HTML — RESOLVED

**Bug:** [#2](task-bugs.md#2-editor-suggest-preserves-raw-html-in-heading-text--resolved)

HTML tags in heading text were preserved verbatim in autocomplete aliases. Fixed by stripping HTML tags from `value.heading` and `value.item.heading` with a regex + `.trim()`.

### 5.3 GFM Collision Suffix: Cross-BaseSlug Collision — RESOLVED

**Bug:** [#3](task-bugs.md#3-gfm-collision-suffix-ambiguity-the-commands-problem--resolved)

The per-baseSlug collision counter was blind to cross-baseSlug collisions. Fixed in v1.2.0+ by extracting `allocateUniqueSlug()` — a shared function that checks the actual set of used slugs rather than per-baseSlug counters. Both `buildDocumentIndex` and `resolveGfmSlug` use it, ensuring consistent slugs.

### 5.4 URL-Encoded Passthrough: Wikilinks vs Markdown Links

**Bug:** [#11](task-bugs.md#11-url-encoded-passthrough-behavior-differs-by-link-format)

Obsidian natively decodes `%20` in markdown links before our interceptor sees them. Wikilinks preserve the encoding. This means the same `#my%20heading` slug is caught by the passthrough guard in wikilinks but passes through (and may resolve) in markdown links.

### 5.5 Passthrough Links Are Silent

**Bug:** [#9](task-bugs.md#9-passthrough-links-produce-no-debug-output)

Working as designed — guard-rejected slugs produce no debug output.

### 5.6 GFM Slug Guard Duplicated Across Modules — RESOLVED

**Tasks:** [TASK-1004](tasks.md#task-1004-extract-isgfmslug-shared-guard-function-done)

**Found during code review (2026-07-16).** **Fixed 2026-07-16.** Extracted `isGfmSlug()` into `gfm-slugify.ts`. Both `resolve-target.ts` and `patch-link-hover.ts` import it. A critical inverted-condition bug was also discovered and fixed during extraction (the guard was passthrough-ing valid GFM slugs). 6 new unit tests (16 assertions) verify the predicate.

### 5.7 Hover Resolution Forked from Main Pipeline — RESOLVED

**Tasks:** [TASK-1005](tasks.md#task-1005-unify-hover-link-resolution-with-indexcache-done)

**Found during code review (2026-07-16).** **Fixed 2026-07-16.** Added `resolveGfmTargetSync()` to `resolve-target.ts` — same guard + file resolution + `buildDocumentIndex(cache)`, no disk I/O. `patch-link-hover.ts` calls this instead of inline resolution. The `require("./document-index")` call eliminated. `tsc --noEmit` now passes with zero errors.

### 5.8 Virtual Block Injection Duplicated — RESOLVED

**Tasks:** [TASK-1006](tasks.md#task-1006-extract-shared-virtual-block-injection-utility-done)

**Found during code review (2026-07-16).** **Fixed 2026-07-16.** Created `src/virtual-block.ts` with `injectVirtualBlock()` + `VIRTUAL_BLOCK_CLEANUP_MS = 1500` constant. Both `patch-link-click.ts` and `patch-link-hover.ts` use it. Cleanup callback pattern replaces naked `setTimeout`.

### 5.9 patch-workspace.ts Violates Single Responsibility — RESOLVED

**Tasks:** [TASK-1007](tasks.md#task-1007-split-patch-workspacets-by-responsibility-done)

**Found during code review (2026-07-16).** **Fixed 2026-07-16.** `patch-workspace.ts` deleted. Replaced by `patch-link-click.ts` (`applyClickPatch`, async + HTML anchors) and `patch-link-hover.ts` (`applyHoverPatch`, sync, no HTML anchors). `main.ts` imports both separately.

### 5.10 O(n²) Section Boundary Algorithm — RESOLVED

**Tasks:** [TASK-1009](tasks.md#task-1009-stack-based-on-section-boundary-algorithm-done)

**Found during code review (2026-07-16).** `buildDocumentIndex` computes section `endLine` using a nested loop: for each heading `i`, scan forward through headings `i+1..n` looking for the first heading with equal-or-higher level. This is O(n²) worst case. For typical files (<100 headings) this is negligible, but a stack-based single-pass algorithm (push headings → pop when same-or-higher level encountered) would be O(n) and simpler to reason about.
**Fixed 2026-07-16.** Replaced nested loop with 2-pass approach: Pass 1 uses a stack to compute all `endLine`/`endOffset` values in O(n), Pass 2 builds `HeadingAnchorTarget` entries. All 25 existing tests pass unchanged. Code is both faster and simpler (no inner loop, no `break`).

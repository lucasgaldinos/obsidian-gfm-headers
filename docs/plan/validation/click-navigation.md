---
title: "Validation: Click Navigation (openLinkText)"
tags: [validation, click-navigation, openLinkText, virtual-block-injection]
description: "Mode × link-format validation matrix for the openLinkText interceptor. Covers ideal path (Virtual Block Injection), fallback path (revealTargetInView), and passthrough."
date_created: 2026-07-15
author: ["Lucas Galdino", "GitHub Copilot"]
plan_version: "2.0"
parent: "[[validation.md]]"
---

# Validation: Click Navigation (`openLinkText`)

> **Implementation category:** Layer 2 (Router) in the [5-layer architecture](../design.md#1-architecture-overview). Intercepts `app.workspace.openLinkText` to route GFM slug links through Virtual Block Injection (ideal path) or `revealTargetInView` (fallback path).

## What's Being Validated

The `openLinkText` interceptor in [`patch-workspace.ts`](../../../src/patch-workspace.ts) is the primary click handler. It must:

1. **Fire for every link click** — wikilinks, markdown links, same-file, cross-file, all three view modes.
2. **Parse the linktext** — extract `notePath` and `slug` from `"Note.md#gfm-slug"` or `"#gfm-slug"`.
3. **Apply the GFM guard** — detect OFM uppercase, URL-encoded, block refs, footnotes → passthrough.
4. **Resolve the target** — `resolveGfmTarget()` → `DocumentIndex` lookup → `HeadingAnchorTarget` or `HtmlAnchorTarget`.
5. **Route to the correct path:**
   - `type === "heading"` → **Ideal path:** Virtual Block Injection (`#^gfm-click-{slug}`) → native block navigation.
   - `type === "html-anchor"` → **Fallback path:** open file without hash → `revealTargetInView(target)`.
   - Not found → Passthrough to original `openLinkText` (let Obsidian handle natively).
6. **Not break native behaviors** — modifier keys (Ctrl/Cmd for new tab), external URLs, same-file flicker.

## Debug Events

| Event | When | Key payload |
| --- | --- | --- |
| `parse:start` | Entry — every intercepted call | `linktext`, `sourcePath` |
| `target:file-resolved` | File found via `getFirstLinkpathDest` | `notePath`, `sourcePath`, `targetPath` |
| `navigation:resolved` | GFM slug → line resolved | `targetPath`, `slug`, `line`, `heading` |
| `navigation:passthrough` | Slug or file not found | `reason`, `linktext` |
| `reveal:preview` | `applyScroll(line, {highlight: true})` | `line`, `highlight` |
| `reveal:editor` | Editor scrolled (Source mode) | `line`, `mode` |
| `reveal:fallback` | Manual `is-flashing` fallback | `line`, `reason` |
| `error` | Any error in the chain | `stage`, `message`, `stack` |

### Investigation-Specific Events (to add for Bug 10)

| Event | When | Key payload |
| --- | --- | --- |
| `openLinkText:entry` | **Top of interceptor** — before ANY logic | `linktext`, `sourcePath`, `newLeaf`, `mode` (Reading/LP/Source) |
| `openLinkText:step5-fallback` | STEP 5 reached (non-heading target) | `targetType`, `targetLine`, `viewMode` |
| `reveal:attempt` | Top of `revealTargetInView` | `line`, `mode`, `viewType` |

## Mode × Link Format Matrix

Test every combination. Cells marked **?** are unknowns that need investigation.

### Wikilinks (`[[file#slug]]` or `[[file#slug|alias]]`)

| Scenario | Reading | Live Preview | Source | Expected |
| --- | --- | --- | --- | --- |
| Unique heading (`#simple-heading`) | ✅ Works | ✅ Works | ✅ Works | Ideal path: `#^gfm-click-simple-heading` |
| Duplicate heading (`#duplicate-1`) | ✅ Works | ✅ Works | ✅ Works | Ideal path: scrolls to correct duplicate |
| HTML anchor standalone (`#html-anchor-section`) | ✅ Works | ❌ **BUG** | ❌ **BUG** | Fallback: open file → reveal. See [Bug 10](../task-bugs.md#10-html-anchor-click-only-works-in-reading-mode). |
| HTML anchor in heading (`#html-anchor-header`) | ✅ Works | ❌ **BUG** | ❌ **BUG** | Same as above. |
| HTML anchor before heading (`#html-anchor-header-1`) | ✅ Works | ❌ **BUG** | ❌ **BUG** | Same as above. |
| OFM uppercase (`#Simple Heading`) | ✅ Passthrough | ✅ Passthrough | ✅ Passthrough | Silent — guard rejects. |
| URL-encoded (`#my%20heading`) | ✅ Passthrough | ✅ Passthrough | ✅ Passthrough | Silent — `%XX` guard rejects. |
| Block reference (`#^block-ref`) | ✅ Passthrough | ✅ Passthrough | ✅ Passthrough | Silent — `^` guard rejects. |
| Same-file (`#simple-heading`) | ✅ Works | ✅ Works | ✅ Works | No flicker — same-file bypass. |

### Markdown Links (`[alias](file.md#slug)`)

| Scenario | Reading | Live Preview | Source | Expected |
| --- | --- | --- | --- | --- |
| Unique heading (`#simple-heading`) | ✅ Works | ✅ Works | ✅ Works | Same as wikilink equivalent. |
| HTML anchor standalone (`#html-anchor-section`) | ✅ Works | ❌ **BUG** | ⚠️ **PARTIAL** (see below) | Fallback path. Source mode: only works when Ctrl+click on `(file.md#anchor)` part. |
| HTML anchor in heading (`#html-anchor-header`) | ✅ Works | ❌ **BUG** | ⚠️ **PARTIAL** | Same as above. |
| URL-encoded (`#my%20heading`) | ⚠️ **Obsidian decodes** | ⚠️ **Obsidian decodes** | ⚠️ **Obsidian decodes** | Obsidian decodes `%20` → ` ` before our interceptor sees it. Slug becomes `"my heading"` (space). May resolve via GFM path. See [Bug 11](../task-bugs.md#11-url-encoded-passthrough-behavior-differs-by-link-format). |

### Click-Position Investigation (Source Mode, Markdown Links)

In Source mode, a markdown link `[alias](file.md#anchor)` has two clickable regions. They may route through different Obsidian code paths:

| Click target | Does `openLinkText` fire? | Observed behavior |
| --- | --- | --- |
| `[alias]` part | **? Unknown** | ❌ Nothing happens for HTML anchors |
| `(file.md#anchor)` part | **? Unknown** | ⚠️ Works — navigates to file, but scroll may fail |

**Investigation procedure:**

1. Add `debugLog("openLinkText:entry", { linktext, sourcePath, mode })` at the **absolute top** of the `openLinkText` interceptor — before the `if (linktext.includes("#"))` guard.
2. In Source mode, Ctrl+click the `[alias]` part of a markdown link targeting an HTML anchor. Check console.
3. In Source mode, Ctrl+click the `(file.md#anchor)` part of the same link. Check console.
4. Compare: does `openLinkText:entry` fire in both cases? If not, what DOES fire?

## Expected Console Traces

### Ideal Path (Heading — Virtual Block Injection)

```out
[GFM] parse:start { linktext: "validation-target.md#commands-1", sourcePath: "test-link.md" }
[GFM] target:file-resolved { notePath: "validation-target.md", sourcePath: "test-link.md", targetPath: "path/to/validation-target.md" }
[GFM] index:build:start { targetPath: "path/to/validation-target.md", headingCount: 13 }
[GFM] index:build:heading { heading: "Commands", line: 20, baseSlug: "commands", finalSlug: "commands", level: 2 }
[GFM] index:build:heading { heading: "Commands-1", line: 34, baseSlug: "commands-1", finalSlug: "commands-1", level: 2 }
[GFM] index:build:heading { heading: "Commands-1", line: 38, baseSlug: "commands-1", finalSlug: "commands-1-1", level: 2 }
[GFM] index:build:heading { heading: "Commands", line: 42, baseSlug: "commands", finalSlug: "commands-2", level: 2 }
[GFM] navigation:resolved { targetPath: "...", slug: "commands-1", line: 34, heading: "Commands-1" }
```

### Fallback Path (HTML Anchor — `revealTargetInView`)

```out
[GFM] parse:start { linktext: "validation-target.md#html-anchor-section", sourcePath: "test-link.md" }
[GFM] target:file-resolved { notePath: "validation-target.md", sourcePath: "test-link.md", targetPath: "..." }
[GFM] index:build:start { targetPath: "...", headingCount: 13 }
[GFM] index:build:html-anchor { id: "html-anchor-section", line: 12 }
[GFM] reveal:fallback { line: 12, reason: "non-heading-target" }
```

## Same-File Navigation

Same-file links (`#slug` without a file prefix) use a special bypass to avoid flicker:

1. Interceptor detects `sourcePath === targetPath` and `!newLeaf`.
2. Skips calling original `openLinkText` entirely.
3. Directly calls Virtual Block Injection or `revealTargetInView`.

| Scenario | Expected |
| --- | --- |
| `[[#simple-heading]]` from within same file | No flicker, immediate scroll + highlight |
| `[[#html-anchor-section]]` from within same file | Fallback path (subject to same Bug 10 mode limitations) |
| Ctrl+click same-file link | Opens in new tab (bypasses same-file optimization) |

## Cross-File View Finding

After `originalOpenLinkText(file.path)` opens a cross-file target:

1. Check `getActiveViewOfType(MarkdownView)` first.
2. If active view doesn't match target file, loop `getLeavesOfType('markdown')` by file path.
3. If still not found, wait for layout change (debounced).

**Verify:** Ctrl+click cross-file link → new tab opens → correct view found → scroll happens.

## Known Bugs in This Category

| Bug | Description | Status |
| --- | --- | --- |
| [Bug 8](../task-bugs.md#8-gfm-collision-suffix-ambiguity-the-commands-problem) | `Map.set()` last-write-wins: literal `## Commands-1` overwrites duplicate's `#commands-1` slug | Open — v2 |
| [Bug 10](../task-bugs.md#10-html-anchor-click-only-works-in-reading-mode) | HTML anchor click fails in Live Preview / Source mode | **Investigating** |
| [Bug 11](../task-bugs.md#11-url-encoded-passthrough-behavior-differs-by-link-format) | URL-encoded slugs: markdown links get decoded by Obsidian before interception | Documented |

## Related Files

- [`src/patch-workspace.ts`](../../../src/patch-workspace.ts) — `openLinkText` interceptor
- [`src/resolve-target.ts`](../../../src/resolve-target.ts) — `resolveGfmTarget()`
- [`src/reveal-target.ts`](../../../src/reveal-target.ts) — `revealTargetInView()`
- [`src/document-index.ts`](../../../src/document-index.ts) — `buildDocumentIndex()`, `scanHtmlAnchors()`

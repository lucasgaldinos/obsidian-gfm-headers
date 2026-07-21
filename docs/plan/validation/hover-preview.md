---
title: "Validation: Hover Preview (trigger('hover-link'))"
tags: [validation, hover-preview, hover-link, page-preview, virtual-block-injection]
description: "Mode × target-type validation matrix for the hover-link interceptor. Covers heading hover (Virtual Block Injection), HTML anchor hover (skipped), and passthrough."
date_created: 2026-07-15
author: ["Lucas Galdino", "GitHub Copilot"]
plan_version: "2.0"
parent: "[[validation.md]]"
---

# Validation: Hover Preview (`trigger('hover-link')`)

> **Implementation category:** Layer 4 (Hover Preview) in the [5-layer architecture](../design.md#1-architecture-overview). Intercepts `app.workspace.trigger('hover-link', ...)` to inject virtual blocks for Page Preview of GFM heading links.

## What's Being Validated

The `trigger('hover-link')` interceptor in [`patch-workspace.ts`](../../../src/patch-workspace.ts) enables Page Preview (the popup that appears on Ctrl/Cmd hover) for GFM links. It must:

1. **Fire on hover events** — intercept `workspace.trigger('hover-link', { event, linktext, sourcePath, ... })`.
2. **Parse the slug** — extract from `data.linktext`, apply the same GFM guard as click navigation.
3. **Resolve the target** — `resolveGfmTarget()` → `DocumentIndex` lookup.
4. **Inject virtual block for headings only** — `type === "heading"` → inject `#^gfm-{slug}` into `cache.blocks`, rewrite `data.linktext`.
5. **Silently skip HTML anchors** — `type === "html-anchor"` → no virtual block, no Page Preview. See [Bug 6](../task-bugs.md#6-html-anchor-hover-inconsistency).
6. **Clean up** — remove virtual block from cache after 1500ms to avoid pollution.

## Debug Events

| Event | When | Key payload |
| --- | --- | --- |
| `hover-link:attempt` | Entry — hover event intercepted | `linktext`, `slug`, `notePath`, `sourcePath`, `fileFound` |
| `hover-link:injected` | Virtual block injected into cache | `originalSlug`, `virtualId`, `targetLine`, `headingCount` |
| `hover-link:passthrough` | Non-GFM or not found | `reason`, `linktext` |
| `error` | Any error in hover chain | `stage`, `message`, `stack` |

## Target Type Matrix

| Target type | Hover behavior | Expected console |
| --- | --- | --- |
| Unique heading (`#simple-heading`) | ✅ Page Preview shows heading section | `hover-link:attempt` → `hover-link:injected` |
| Duplicate heading (`#duplicate-1`) | ✅ Page Preview shows **exact** duplicate section | `hover-link:attempt` → `hover-link:injected` with correct `targetLine` |
| HTML anchor standalone (`#html-anchor-section`) | ❌ No Page Preview ("unable to find") | `hover-link:attempt` only — silently skipped (type !== "heading") |
| HTML anchor in heading (`#html-anchor-header`) | ❌ No Page Preview | Same as above — anchor type, not heading |
| Heading with embedded HTML, via GFM slug (`#a-header-with-an-anchor-a-idhtml-anchor-headera`) | ✅ Page Preview works | This IS a heading type — resolves normally |
| OFM uppercase (`#Simple Heading`) | ❌ No Page Preview | Silent passthrough — guard rejects |
| URL-encoded (`#my%20heading`) | ❌ No Page Preview (wikilinks) / ⚠️ May activate (markdown links) | Wikilinks: `%XX` guard. Markdown: Obsidian decodes first. See [Bug 11](../task-bugs.md#11-url-encoded-passthrough-behavior-differs-by-link-format). |

## Mode Matrix

| Mode | Hover behavior |
| --- | --- |
| Reading | ✅ Page Preview activates on Ctrl/Cmd hover over heading links |
| Live Preview | ✅ Page Preview activates on Ctrl/Cmd hover over heading links |
| Source mode | ✅ Page Preview activates on Ctrl/Cmd hover over heading links |

> **Note:** Hover preview requires the `hover-link` event, which Obsidian dispatches in all three modes. Mode-dependent failures (if any) would indicate the event isn't firing, not that our interceptor fails.

## Virtual Block Injection — Verification

The virtual block injection mechanism works as follows:

1. Get `target.line` and `target.endLine` from `DocumentIndex`.
2. Generate `virtualId = "gfm-{slug}"`.
3. Mutate `cache.blocks`:

   ```typescript
   cache.blocks[virtualId] = {
     id: virtualId,
     position: { start: { line: target.line, col: 0, offset: 0 },
                  end: { line: target.endLine, col: 0, offset: 0 } }
   };
   ```

4. Rewrite `data.linktext` to `#^gfm-{slug}`.
5. Call `originalTrigger(...)` — Obsidian's `HoverPopover` renders the block.
6. `setTimeout(() => delete cache.blocks[virtualId], 1500)`.

**Verify:** After hover, check that the virtual block is cleaned up:

```typescript
// In console, 2 seconds after hover:
app.metadataCache.getFileCache(file).blocks["gfm-simple-heading"]
// → undefined
```

## Known Bugs in This Category

| Bug | Description | Status |
| --- | --- | --- |
| [Bug 6](../task-bugs.md#6-html-anchor-hover-inconsistency) | HTML anchor hover fails — virtual block injection only handles heading type | Open — v2 |
| [Bug 4 (Session 1)](../task-bugs.md#1-hover-preview-fails-hovering-cant-find--links-nowhere) | `buildDocumentIndex(cache.headings)` → empty index | **Resolved** — corrected to `buildDocumentIndex(cache)` |

## Expected Console Trace — Successful Hover

```out
[GFM] hover-link:attempt { linktext: "validation-target.md#simple-heading", slug: "simple-heading", notePath: "validation-target.md", sourcePath: "test-link.md", fileFound: true }
[GFM] hover-link:injected { originalSlug: "simple-heading", virtualId: "gfm-simple-heading", targetLine: 0, headingCount: 13 }
```

## Expected Console Trace — HTML Anchor Hover (Skipped)

```out
[GFM] hover-link:attempt { linktext: "validation-target.md#html-anchor-section", slug: "html-anchor-section", notePath: "validation-target.md", sourcePath: "test-link.md", fileFound: true }
(no hover-link:injected — silently skipped because target.type === "html-anchor")
```

## Related Files

- [`src/patch-workspace.ts`](../../../src/patch-workspace.ts) — `trigger('hover-link')` interceptor
- [`src/resolve-target.ts`](../../../src/resolve-target.ts) — `resolveGfmTarget()`
- [`src/document-index.ts`](../../../src/document-index.ts) — `buildDocumentIndex()`, `scanHtmlAnchors()`

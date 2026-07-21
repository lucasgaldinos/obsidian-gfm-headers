---
title: "GFM Spec & Plugin Comparisons"
tags: [research, comparison, gfm-spec]
description: "Comparison of GFM heading link plugins and detailed heading transformation behavior."
---

# GFM Spec & Plugin Comparisons

This document combines the architectural comparisons of Obsidian GFM plugins and the specifications for heading transformation.

## 1. GFM Slugification Rules

To correctly map markdown headings to GFM slugs, the following rules (based on GitHub's official algorithm) must be implemented:

1. **Lowercase**: Convert all letters to lowercase.
2. **Unicode Preservation**: Do not strip non-ASCII letters (e.g., `é`, `Θ`, `ñ`). They are kept intact.
3. **Punctuation**: Remove all punctuation and special characters *except* hyphens (`-`) and underscores (`_`).
4. **Spaces**: Convert spaces to hyphens.
5. **Formatting**: Markdown formatting marks (like `_` for italics or `*` for bold) are conceptually stripped by GitHub, but since we receive raw text from Obsidian's cache, we only apply the punctuation rules.
6. **Hyphen Cleanup**: Collapse consecutive hyphens into a single hyphen, and trim leading/trailing hyphens.
7. **Duplicates**: If a slug already exists in the document, append `-1`, `-2`, etc.

**Example Transformations:**

- `Hello World` → `hello-world`
- `Café y Niño` → `café-y-niño`
- `Red Hat-Based Distributions (CentOS, Fedora)` → `red-hat-based-distributions-centos-fedora`

## 2. Plugin Comparisons

There are three primary plugins attempting to solve GFM heading links in Obsidian.

### A. obsidian-gfm-headers (This Plugin)

- **Strategy**: Monkeypatch `openLinkText`, `EditorSuggest.selectSuggestion`, and `trigger('hover-link')`.
- **Strengths**: Lightweight (no DOM rewriting, no CM6 ViewPlugins), works in all modes natively, preserves Obsidian's native `is-flashing` animations.
- **Implementation**: Uses a standalone Document Index to map slugs to line numbers, and leverages Virtual Block Injection (`#^virtual-id`) to force Obsidian's native routing to handle block-level scrolling and highlighting.

### B. parkisutama/obsidian-gfm-anchor

- **Strategy**: DOM rewriting for hover preview (mutating `href`), custom click/mousedown capture events.
- **Strengths**: Granular DOM control, avoids patching `openLinkText`.
- **Weaknesses**: Manual scroll implementation loses the native Obsidian `is-flashing` highlight, requires heavy CM6 plugins.

### C. MMadmer/Obsidian-GFM-Compatibility

- **Strategy**: Document index + DOM decoration + custom click handler.
- **Strengths**: Supports HTML `<a id>` anchors out of the box, no monkeypatching.
- **Weaknesses**: Modifies the DOM extensively, strips unicode characters in a way that breaks true GFM compatibility (e.g., converts `café` to `cafe`).

## 3. Detailed Comparisons

### Guard / Slug Detection Comparison

| Check | This plugin | parkisutama | GFM-Compat |
| --- | --- |---|---|
| Non-empty | `slug.length > 0` | `fragment.length === 0` | `if (!slug) return null` |
| No uppercase | `!/[A-Z]/.test(slug)` | `!/[A-Z]/u.test(fragment)` | Not checked (normalizes to lowercase) |
| No `%XX` encoding | `!/%[0-9A-Fa-f]{2}/.test(slug)` | `!/%[0-9A-Fa-f]{2}/u.test(fragment)` | `safeDecode` handles it |
| External link | N/A (handled by Obsidian) | N/A | `/^[a-z][a-z\d+\-.]*:/iu` |

### Summary

| If you want... | Choose |
| --- | --- |
| Simplest code, native behaviors, `is-flashing` | **obsidian-gfm-headers** (this plugin) |
| Full Live Preview DOM control, no monkeypatching | **parkisutama/obsidian-gfm-anchor** |
| HTML `<a id>` anchor support, custom highlight | **Obsidian-GFM-Compatibility** |

## 4. Architectural Flow

Below is the abstract ASCII diagram mapping out how the monkeypatch and document index fit together to resolve GFM clicks without mutating the DOM:

```text
                    ┌─────────────────────────────────┐
                    │         Plugin onload()         │
                    └──────────────┬──────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
  ┌───────────────┐     ┌──────────────────┐     ┌──────────────────┐
  │ Document      │     │  Workspace       │     │  Vault Events    │
  │ Index Cache   │     │  Patches         │     │  (invalidation)  │
  │               │     │  (existing)      │     │                  │
  │ Map<filePath, │     │                  │     │ modify/delete/   │
  │  Map<gfmSlug, │     │ openLinkText     │     │ rename → clear   │
  │   {line,      │     │ trigger(hover)   │     │ cache entry      │
  │    heading}>  │     │                  │     │                  │
  └───────┬───────┘     └────────┬─────────┘     └──────────────────┘
          │                      │
          │                      │
          ▼                      ▼
  ┌───────────────────────────────────────────────────┐
  │              Click / Hover Event                  │
  │                                                   │
  │  1. Extract GFM slug from linktext                │
  │  2. Guard: lowercase? no %XX? non-empty?          │
  │     │           │                                 │
  │    Yes          No                                │
  │     │           │                                 │
  │     ▼           ▼                                 │
  │  Lookup in    passthrough to                      │
  │  document     Obsidian default                    │
  │  index        (OFM links)                         │
  │     │                                             │
  │     ▼                                             │
  │  Found?                                           │
  │   │        │                                      │
  │  Yes       No                                     │
  │   │        │                                      │
  │   ▼        ▼                                      │
  │  Inject Virtual Block &                           │
  │  passthrough to openLinkText                      │
  │   │                                               │
  │   ▼                                               │
  │  After file opens:                                │
  │  Obsidian natively scrolls and highlights         │
  │  the injected block.                              │
  └───────────────────────────────────────────────────┘
```

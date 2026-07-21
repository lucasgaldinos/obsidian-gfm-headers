---
title: "Validation: Autocomplete (EditorSuggest.selectSuggestion)"
tags: [validation, autocomplete, editorsuggest, link-creation, gfm-slug]
description: "Link-format × heading-type validation matrix for the EditorSuggest interceptor. Covers GFM slug output, alias preservation, HTML in headings, wikilink vs markdown link, and duplicate suffix resolution."
date_created: 2026-07-15
author: ["Lucas Galdino", "GitHub Copilot"]
plan_version: "2.0"
parent: "[[validation.md]]"
---

# Validation: Autocomplete (`EditorSuggest.selectSuggestion`)

> **Implementation category:** Layer 3 (Autocomplete) in the [5-layer architecture](../design.md#1-architecture-overview). Intercepts `EditorSuggest.selectSuggestion` to mutate `value.subpath` into a GFM slug before Obsidian natively inserts the link.

## What's Being Validated

The `EditorSuggest` interceptor in [`patch-editor-suggest.ts`](../../../src/patch-editor-suggest.ts) ensures that when a user selects a heading from the `[[` autocomplete dropdown, the inserted link uses a GFM slug. It must:

1. **Intercept `selectSuggestion(value, evt)`** on Obsidian's native `EditorSuggest` instance.
2. **Compute the correct GFM slug** — use `resolveGfmSlug()` to handle duplicate headings (occurrence index from dropdown).
3. **Mutate `value.subpath` only** — preserve `value.heading` (the alias/display text).
4. **Handle wikilinks vs markdown links** — check `app.vault.getConfig("useMarkdownLinks")`.
5. **Not corrupt the alias** — no raw HTML in display text (see [Bug 7](../task-bugs.md#7-editor-suggest-preserves-raw-html-in-heading-text)).
6. **Handle duplicate headings** — the Nth duplicate in the dropdown maps to the Nth duplicate in the file.

## Debug Events

| Event | When | Key payload |
| --- | --- | --- |
| `suggest:mutated` | `value.subpath` mutated to GFM slug | `originalSubpath`, `newSubpath`, `heading` |
| `suggest:selected` | Suggestion selected (intercepted) | `heading`, `level`, `occurrenceIndex` |

## Link Format Matrix

### Markdown Links (`Use Markdown Links = true`)

| Heading type | Expected output | Status |
| --- | --- | --- |
| Simple (`# Simple Heading`) | `[Simple Heading](file.md#simple-heading)` | ✅ Working |
| With HTML (`## Heading <a id="x"></a>`) | `[Heading](file.md#heading-a-idx-a)` | ✅ Resolved — HTML stripped + trimmed |
| Duplicate (2nd occurrence) | `[Heading](file.md#heading-1)` | ✅ Working |
| Unicode (`## Café y Niño`) | `[Café y Niño](file.md#café-y-niño)` | ✅ Working |
| Underscore (`## my_var`) | `[my_var](file.md#my_var)` | ✅ Working |

### Wikilinks (`Use Markdown Links = false`)

| Heading type | Expected output | Current output | Status |
| --- | --- | --- | --- |
| Simple | `[[file#simple-heading\|Simple Heading]]` | `[[file#simple-heading]]` | ❌ Missing alias — [OBJ-009](../objectives.md#v2-objectives-deferred), [TASK-1001](../tasks.md#task-1001-wikilink-aware-editor-suggestions-todo) |
| With HTML | `[[file#heading-a-idx-a\|Heading]]` | `[[file#heading-a-idx-a]]` | ❌ Missing alias + HTML in alias |
| Duplicate | `[[file#heading-1\|Heading]]` | `[[file#heading-1]]` | ❌ Missing alias |

## Heading Type Matrix

| Heading text | GFM slug | Alias preserved? | Duplicate suffix correct? |
| --- | --- | --- | --- |
| `Simple Heading` | `simple-heading` | ✅ | N/A (unique) |
| `Commands` (1st) | `commands` | ✅ | N/A |
| `Commands` (2nd) | `commands-1` | ✅ | ✅ |
| `Commands-1` (literal) | `commands-1` | ✅ | ✅ (collision handled) |
| `Commands-1` (2nd literal) | `commands-1-1` | ✅ | ✅ |
| `Café y Niño` | `café-y-niño` | ✅ | N/A |
| `my_variable_name` | `my_variable_name` | ✅ | N/A |
| `A header with an anchor <a id="x"></a>` | `a-header-with-an-anchor-a-idx-a` | ✅ HTML stripped | N/A |

## Duplicate Suffix Resolution — Verification

The advanced `resolveGfmSlug(value, app, suggestInstance)` helper uses `suggestInstance.chooser.values` to map the Nth identical heading in the dropdown to the Nth occurrence in `metadataCache.headings`.

**Verify:** Create a file with 3 identical `## Test` headings. Open `[[` autocomplete. Select the 2nd `Test` from the dropdown. Verify inserted link uses `#test-1` (the GFM collision suffix for the 2nd occurrence).

## Edge Cases

| Scenario | Expected | Status |
| --- | --- | --- |
| Rapid typing — cache may be stale | Suffix may be off-by-one momentarily | ⚠️ Known limitation (cache latency). Correct on next build. |
| Heading with only punctuation (`## !!!`) | Slug is empty string `""` | ⚠️ Edge case — should test |
| Heading with only emoji (`## 😀😀😀`) | Slug is empty string `""` (no ASCII) | ⚠️ Edge case — should test |
| Extremely long heading (500+ chars) | Slug truncated? Or full length? | ⚠️ Not tested |
| Heading starting with numbers (`## 1. Introduction`) | `1-introduction` | ⚠️ Not tested |

## Known Bugs in This Category

| Bug | Description | Status |
| --- | --- | --- |
| [Bug 2.1](../task-bugs.md#21-autocomplete-alias-loss--missing-duplicate-suffixes) | Alias loss + duplicate suffix resolution | **Resolved** — stop mutating `value.heading`, use dropdown occurrence index |
| [Bug 7](../task-bugs.md#7-editor-suggest-preserves-raw-html-in-heading-text) | HTML tags preserved verbatim in alias text | **Resolved** — regex strip `<\/?[^>]+(>\|$)/g` + `.trim()` on `value.heading` |
| [TASK-1001](../tasks.md#task-1001-wikilink-aware-editor-suggestions-todo) | Wikilinks missing `\|Original Heading` alias | Deferred to v2 |

## Related Files

- [`src/patch-editor-suggest.ts`](../../../src/patch-editor-suggest.ts) — `EditorSuggest.selectSuggestion` interceptor
- [`src/gfm-slugify.ts`](../../../src/gfm-slugify.ts) — `gfmSlugify()`
- [`src/document-index.ts`](../../../src/document-index.ts) — `buildDocumentIndex()` (used for slug lookup during autocomplete)

---
title: "Validation Matrix & Debug Logging"
tags: [architecture, plan, validation, testing, debug]
description: "15-scenario × 3-mode manual validation matrix, 14 debug event types, and expected console traces for successful navigation and passthrough cases."
date_created: 2026-07-08
date_changed: 2026-07-14
author: ["Lucas Galdino", "GitHub Copilot"]
plan_version: "2.0"
parent: "[[plan.md]]"
---

# Validation Matrix & Debug Logging

> Extracted from [`plan.md`](../plan.md). See [`objectives.md`](../objectives.md) for scope, [`design.md`](../design.md) for expected behavior, and [`tasks.md`](../tasks.md) for verification steps per task.

## Implementation Category Files

The plugin has 5 implementation layers. Each has a dedicated validation file with mode × scenario matrices, debug event references, expected console traces, and known bugs:

| Category | Layer | File | Focus |
| --- | --- | --- | --- |
| Click Navigation | 2 — Router | [`click-navigation.md`](click-navigation.md) | `openLinkText` interceptor, ideal vs fallback path, mode × link-format matrix |
| Hover Preview | 4 — Hover | [`hover-preview.md`](hover-preview.md) | `trigger('hover-link')` interceptor, Virtual Block Injection, HTML anchor hover gaps |
| Autocomplete | 3 — Autocomplete | [`autocomplete.md`](autocomplete.md) | `EditorSuggest.selectSuggestion` interceptor, GFM slug output, alias preservation |
| Reveal Target | 5 — Reveal | [`reveal-target.md`](reveal-target.md) | `revealTargetInView`, `applyScroll`, mode-dependent scrolling, fallback mechanism |
| Passthrough & Guard | Cross-cutting | [`passthrough.md`](passthrough.md) | GFM guard logic, uppercase/URL-encoded/block-ref detection, format-dependent behavior |

> **Bug 10 (HTML Anchor Click)** spans the Click Navigation and Reveal Target categories. See the [investigation plan](../task-bugs.md#10-html-anchor-click-only-works-in-reading-mode) in the bug tracker and the mode × link-format matrix in [`click-navigation.md`](click-navigation.md#mode--link-format-matrix).

## Manual validation matrix

Test every scenario in Reading view, Live Preview, and Source mode. Each scenario maps to an [objective](../objectives.md#objectives) and implementation [task](../tasks.md).

| Scenario | Reading | Live Preview | Source | Expected result |
| --- | --- | --- | --- | --- |
| Same-file unique heading | Required | Required | Required | Navigates to heading, flashes yellow. |
| Same-file duplicate heading | Required | Required | Required | `#commands-1` targets second duplicate. |
| Literal suffix collision | Required | Required | Required | `Commands-1` and duplicate `Commands` both resolve. |
| Cross-file unique heading | Required | Required | Required | Target file opens, reveals heading. |
| Cross-file duplicate heading | Required | Required | Required | Target file opens, reveals correct duplicate. |
| Unicode heading | Required | Required | Required | Unicode slug resolves without diacritic stripping. |
| Underscore heading | Required | Required | Required | Literal underscore preserved in slug. |
| HTML anchor | Deferred (v2) | Deferred (v2) | Deferred (v2) | Deferred. |
| OFM uppercase heading | Required | Required | Required | Plugin passes through to Obsidian default. |
| URL-encoded OFM heading | Required | Required | Required | Plugin passes through to Obsidian default. |
| Block reference | Required | Required | Required | Plugin passes through to Obsidian default. |
| External URL | Required | Required | N/A | Plugin does not intercept. |
| Ctrl/Cmd hover | Required | Required | N/A | Page Preview correct for heading links. |
| Ctrl/Cmd click | Required | Required | Required | New tab opens, scrolls correctly. |
| Mobile tap | Required | Required | Required | No desktop-only crash. |
| Autocomplete Dropdown | Required | Required | Required | Selecting a heading outputs a GFM slug while preserving alias. |

### Bug Validation (Resolved)

The architectural caveats identified during Phase 4 were tested and fully resolved during Session 2/3:

| Scenario | Reading | Live Preview | Source | Expected result (if bug is present) |
| --- | --- | --- | --- | --- |
| Same-file link flicker | Required | Required | Required | RESOLVED: Bypassing native resolution with `#^virtual-id` for same-file links eliminated flicker. |
| Hover duplicate limitation | Required | Required | N/A | RESOLVED: Virtual block injection allows hovering to show the exact duplicate section. |
| Wikilink Alias Loss | Required | Required | Required | RESOLVED: Stopped mutating `value.heading` in `EditorSuggest`, preserving alias. |
| Cache Latency | Required | Required | Required | RESOLVED: Advanced dropdown `occurrenceIndex` mapping bypasses stale cache reads. |

## Debug logging event reference

Set `DEBUG_ENABLED = true` in [`src/debug.ts`](../../../src/debug.ts) ([TASK-0501](../tasks.md#task-0501-implement-srcdebugts-done)), then reload plugin.

| Event | Payload fields | When |
| --- | --- | --- |
| `parse:start` | `linktext`, `sourcePath` | Every intercepted `openLinkText` call |
| `parse:passthrough` | `reason`, `linktext` | Non-GFM link detected |
| `target:file-resolved` | `notePath`, `sourcePath`, `targetPath` | File resolved via `getFirstLinkpathDest` |
| `index:build:start` | `targetPath`, `headingCount` | DocumentIndex being built |
| `index:build:heading` | `heading`, `line`, `baseSlug`, `finalSlug`, `level` | Each heading during index build |
| `index:build:html-anchor` | `id`, `line` | Each HTML anchor found |
| `index:cache:hit` | `targetPath` | Index found in cache |
| `index:cache:invalidate` | `event`, `path`, `oldPath` | Cache cleared (modify/delete/rename) |
| `navigation:resolved` | `targetPath`, `slug`, `line`, `heading` | GFM slug → line resolved |
| `navigation:passthrough` | `reason`, `linktext` | Slug or file not found |
| `reveal:preview` | `line`, `highlight` | `applyScroll(line, {highlight: true})` |
| `reveal:editor` | `line`, `mode` | Editor scrolled (Source mode) |
| `reveal:fallback` | `line`, `reason` | Manual `is-flashing` fallback |
| `error` | `stage`, `message`, `stack` | Any error |

## Expected console trace — successful GFM click

```js
[GFM] parse:start { linktext: "Target.md#commands-1", sourcePath: "Source.md" }
[GFM] target:file-resolved { notePath: "Target.md", sourcePath: "Source.md", targetPath: "path/to/Target.md" }
[GFM] index:build:start { targetPath: "path/to/Target.md", headingCount: 5 }
[GFM] index:build:heading { heading: "Commands", line: 5, baseSlug: "commands", finalSlug: "commands", level: 2 }
[GFM] index:build:heading { heading: "Commands", line: 15, baseSlug: "commands", finalSlug: "commands-1", level: 3 }
[GFM] index:build:heading { heading: "Variables", line: 20, baseSlug: "variables", finalSlug: "variables", level: 2 }
[GFM] index:build:heading { heading: "Functions", line: 30, baseSlug: "functions", finalSlug: "functions", level: 2 }
[GFM] index:build:heading { heading: "Commands-1", line: 45, baseSlug: "commands-1", finalSlug: "commands-2", level: 2 }
[GFM] navigation:resolved { targetPath: "...", slug: "commands-1", line: 15, heading: "Commands" }
[GFM] reveal:preview { line: 15, highlight: true }
```

## Expected console trace — passthrough (OFM uppercase)

```js
[GFM] parse:start { linktext: "Target.md#My Heading", sourcePath: "Source.md" }
[GFM] parse:passthrough { reason: "not-gfm", linktext: "Target.md#My Heading" }
```

## Reveal-Target Path Validation

> Added per [TASK-0904](../tasks.md#task-0904-reveal-target-validation-guide-todo). Validates the question from `reveal-target.ts` `[^obs-3a]`: "Is this really a fallback or the main mechanism?" Covers **all scenarios** from the [manual validation matrix](#manual-validation-matrix).
>
> Bugs discovered during this testing are tracked in [task-bugs.md](../task-bugs.md#session-3-validation-matrix-testing--2026-07-14) (Session 3).

### Test setup

1. Set `DEBUG_ENABLED = true` in `src/debug.ts`.
2. Reload the plugin in Obsidian.
3. Create the **target file** `validation-target.md`:

    ```markdown
    # Simple Heading

    A unique heading with straightforward text. Links to `#simple-heading`.

    ## Duplicate

    First occurrence of a duplicate heading. Links to `#duplicate`.

    Some content between the duplicates.

    <a id="html-anchor-section"></a>
    An HTML anchor for testing the fallback reveal path. Links to `#html-anchor-section`.

    ## A header with an anchor <a id="html-anchor-header"></a>

    Heading with embedded HTML anchor. GFM slug strips the HTML tags, producing `#a-header-with-an-anchor-a-idhtml-anchor-headera`. The `<a>` tag is also scanned as a standalone HTML anchor with id `html-anchor-header`.

    <a id="html-anchor-header-1"></a>
    ## Another header with an anchor

    HTML anchor on the line immediately before a heading. Tests whether hover resolves to the anchor or the heading.

    ## Commands

    First "Commands" heading — participates in literal suffix collision test with `## Commands-1` below.

    ## Duplicate

    Second occurrence of "Duplicate". Links to `#duplicate-1`.

    ## Café y Niño

    Unicode heading with accented characters and Spanish. Links to `#café-y-niño`.

    ## my_variable_name

    Underscore-preserving heading. GFM keeps underscores literal, so the slug is `#my_variable_name`.

    ## Commands-1

    A heading whose **literal text** is "Commands-1". Creates a collision with the GFM-generated suffix for duplicate "Commands" headings. The literal "Commands-1" gets slug `#commands-1` (first in document order). See [Bug 8](task-bugs.md#8-gfm-collision-suffix-ambiguity-the-commands-problem).

    ## Commands-1

    Second literal "Commands-1" heading. GFM slug becomes `#commands-1-1` because `#commands-1` is already taken.

    ## Commands

    Second "Commands" heading. GFM slug becomes `#commands-2` because `#commands-1` and `#commands-1-1` are already taken by the literal headings above.
    ```

4. Create the **link file** `validation-links.md`:

    ```markdown
    ---
    tags: [validation, test]
    ---

    # GFM Heading Links — Validation Link File

    Open DevTools (`Ctrl+Shift+I`), then click or hover each link. Observe `[GFM Heading Links]` output.

    ## GFM Links (should resolve via Virtual Block Injection)

    - [[validation-target.md#simple-heading]] — unique heading
    - [[validation-target.md#duplicate]] — first duplicate
    - [[validation-target.md#duplicate-1]] — second duplicate (GFM collision suffix)
    - [[validation-target.md#commands]] — first "Commands"
    - [[validation-target.md#commands-1]] — **literal** "Commands-1" heading
    - [Commands-1 second](validation-target.md#commands-1-1) — second literal "Commands-1"
    - [[validation-target.md#commands-2]] — second "Commands" (suffix `-2` because `-1` taken by literal)
    - [[validation-target.md#café-y-niño]] — unicode heading
    - [[validation-target.md#my_variable_name]] — underscore-preserving heading
    - [[validation-target.md#html-anchor-section]] — standalone HTML anchor (fallback path)

    ## HTML Anchor Edge Cases

    - [A header with an anchor (via heading slug)](validation-target.md#a-header-with-an-anchor-a-idhtml-anchor-headera) — heading GFM slug (contains stripped HTML)
    - [A header with an anchor (via anchor id)](validation-target.md#html-anchor-header) — HTML anchor id inside heading
    - [A header with an anchor](validation-target.md#html-anchor-header) — alias-only, anchor id target
    - [Another header with an anchor](validation-target.md#another-header-with-an-anchor) — normal heading, anchor on previous line
    - [Another header with an anchor](validation-target.md#html-anchor-header-1) — anchor id before heading

    ## Passthrough Links (should NOT be intercepted)

    - [[validation-target.md#Simple Heading]] — OFM uppercase (passthrough)
    - [[validation-target.md#my%20heading]] — URL-encoded (passthrough)
    - [[validation-target.md#^block-ref]] — block reference (passthrough)
    - [[validation-target.md#[^footnote]]] — footnote reference (passthrough)

    ## Same-File Links (test from within validation-target.md itself)

    Open `validation-target.md` and add these links at the bottom, then click them:

    - [[#simple-heading]] — same-file unique heading
    - [[#duplicate]] — same-file first duplicate
    - [[#duplicate-1]] — same-file second duplicate
    - [[#café-y-niño]] — same-file unicode
    - [A header with an anchor <a id="html-anchor-header"></a>](#a-header-with-an-anchor-a-idhtml-anchor-headera)
    - [Commands-1](#commands-1)
    - [Commands](#commands)
    - [Commands](#commands-1)
    - [Commands-1](#commands-1-1)
    <!-- See the problem here? -->

    ## External URL (should NOT be intercepted)

    - [External Link](https://obsidian.md) — should open in browser, not intercepted
    ```

### Same-file links

Open `validation-target.md` and add these at the bottom, then click:

- `[[#simple-heading]]` — same-file unique heading
- `[[#duplicate]]` / `[[#duplicate-1]]` — same-file duplicates
- `[[#café-y-niño]]` — same-file unicode
- `[Commands](#commands)` / `[Commands-1](#commands-1)` / `[Commands-1 second](#commands-1-1)` — collision suffix variants

### Test procedure

| # | Link | Expected path | Verify | Behavior |
| --- | --- | --- | --- | --- |
| 1 | `[[validation-target.md#simple-heading]]` | Ideal | `#^gfm-click-simple-heading` injected. Native scroll + highlight. | `{originalSlug: 'simple-heading', virtualId: 'gfm-simple-heading', targetLine: 0, headingCount: 13}`</br>`fileFound: true, filePath: "validation-target.md", linktext: "validation-target.md#simple-heading", notePath: "validation-target.md", slug: "simple-heading", sourcePath: "test-link.md"`</br>Working as expected. |
| 2 | `[[validation-target.md#duplicate]]` | Ideal | Scrolls to FIRST "Duplicate". | Correct scrolling there. Working as expected |
| 3 | `[[validation-target.md#duplicate-1]]` | Ideal | Scrolls to SECOND "Duplicate". | Correct scrolling there. Working as expected |
| 4 | `[[validation-target.md#commands]]` | Ideal | Scrolls to first `## Commands`. | Correct scrolling there. Working as expected |
| 5 | `[[validation-target.md#commands-1]]` | Ideal | Scrolls to LITERAL `## Commands-1`, NOT duplicate of Commands. | Scrolls to the last registered name, e.g. in [validation-target](/home/lucas_galdino/my_pc/projects/test_vault/validation-target.md), it goes to the last literal `## Commands`. But, in [validation-target-duplicate-commands](/home/lucas_galdino/my_pc/projects/test_vault/validation-target-duplicate-behavior.md), it goes to the literal `## Commands-1` (the first one with the name, but appearing after second `## Commands`) |
| 6 | `[Commands-1 second](validation-target.md#commands-1-1)` | Ideal | Scrolls to second literal `## Commands-1`. | Works as intended |
| 7 | `[[validation-target.md#commands-2]]` | Ideal | Scrolls to second `## Commands` (slug shifted to `-2`). | Works as intended |
| 8 | `[[validation-target.md#café-y-niño]]` | Ideal | Unicode preserved: `café-y-niño` not `cafe-y-nino`. | Works as intended |
| 9 | `[[validation-target.md#my_variable_name]]` | Ideal | Underscores preserved: `my_variable_name`. | Works as intended |
| 10 | `[[validation-target.md#html-anchor-section]]` | Fallback | Opens file, `revealTargetInView()` scrolls. Brief flicker possible. | This one is missing other examples. </br>**hover link and go on <kbd>ctrl+right click</kbd> only works within Reading Mode. For Live Preview mode, neither clicking nor hovering does anything. Source mode only works if the <kbd>ctrl+right click</kbd> is at the parenthesis part.**</br> ````[GFM Heading Links] hover-link:attempt {linktext: '#a-header-with-an-anchor-a-idhtml-anchor-headera', slug: 'a-header-with-an-anchor-a-idhtml-anchor-headera', notePath: ''>, sourcePath: 'validation-target.md', fileFound: true, …}```` </br>````[GFM Heading Links] hover-link:injected {originalSlug: 'a-header-with-an-anchor-a-idhtml-anchor-headera', virtualId: 'gfm-a-header-with-an-anchor-a-idhtml-anchor-headera', targetLine: 13, headingCount: 13}````</br> ````[GFM Heading Links] hover-link:attempt {linktext: '#a-header-with-an-anchor-a-idhtml-anchor-headera', slug: 'a-header-with-an-anchor-a-idhtml-anchor-headera', notePath: '', sourcePath: 'validation-target.md', fileFound: true, …}````</br> ````[GFM Heading Links] hover-link:injected {originalSlug: 'a-header-with-an-anchor-a-idhtml-anchor-headera', virtualId: 'gfm-a-header-with-an-anchor-a-idhtml-anchor-headera', targetLine: 13, headingCount: 13}```` |
| 11 | `[[validation-target.md#Simple Heading]]` | Passthrough | Silent — uppercase triggers guard. | Works as intended |
| 12 | `[[validation-target.md#my%20heading]]` | Passthrough | Silent — `%20` triggers guard. | Passthrough, with observations |
| 13 | `[[validation-target.md#^block-ref]]` | Passthrough | Silent — `^` triggers guard. | Passthrough, with observations |
| 14 | Same-file `[[#simple-heading]]` | Ideal | `#^gfm-click-simple-heading` without file prefix (no flicker). | Passthrough, with observations |

### Observed results (Session 3)

The following behaviors were observed during testing and documented as bugs:

| Scenario | Click | Hover | Bug reference |
| --- | --- | --- | --- |
| Standalone `<a id="html-anchor-section">` | ✅ Fallback path works | — | — |
| Heading with embedded `<a id>` → linked via heading slug | ✅ Works | ✅ Works | — |
| Heading with embedded `<a id>` → linked via anchor id | ✅ Works (goes to right header) | ❌ No hover link | [Bug 6](../task-bugs.md#6-html-anchor-hover-inconsistency) |
| Anchor on line before heading → linked via heading slug | ✅ Works | ✅ Works | — |
| Anchor on line before heading → linked via anchor id | ✅ Works | ❌ No hover link | [Bug 6](../task-bugs.md#6-html-anchor-hover-inconsistency) |
| Autocomplete on heading with embedded HTML | ⚠️ Raw HTML in alias | N/A | [Bug 7](../task-bugs.md#7-editor-suggest-preserves-raw-html-in-heading-text) |
| Literal `## Commands-1` vs duplicate `## Commands` | ✅ Resolves correctly | ✅ Resolves correctly | [Bug 8](../task-bugs.md#8-gfm-collision-suffix-ambiguity-the-commands-problem) |
| OFM uppercase / URL-encoded / block refs | ✅ Silent passthrough | ✅ Silent passthrough | [Bug 9](../task-bugs.md#9-passthrough-links-produce-no-debug-output) |

### How to verify which path executed

In `patch-workspace.ts`, the `openLinkText` interceptor structure:

```typescript
if (targetResolution.target.type === "heading") {
    // → IDEAL PATH: Virtual Block Injection (#^gfm-click-{slug})
}
// → FALLBACK PATH: revealTargetInView() for non-heading targets
```

Check the console for these `debugLog` events:

- `patch:hover-link:injected` — hover preview used virtual block
- `patch:hover-link:attempt` — hover preview attempted resolution
- `virtualId = "gfm-click-..."` in openLinkText flow → ideal path
- `revealTargetInView` called → fallback path

### Expected console output

**Successful GFM click (ideal path):**

```out
[GFM Heading Links] hover-link:attempt {linktext: 'validation-target.md#simple-heading', slug: 'simple-heading', ...}
[GFM Heading Links] hover-link:injected {originalSlug: 'simple-heading', virtualId: 'gfm-simple-heading', targetLine: 0, headingCount: 8}
```

**Passthrough (silent):**
No output — the guard in `resolveGfmTarget()` returns `{ type: "passthrough" }` before any debug logging.

### v2 Improvements Tracked

Two v2 features emerged from validation testing. These are tracked as deferred objectives and tasks — not for v1.x:

- **Wikilink-aware editor suggestions** ([OBJ-009](../objectives.md#v2-objectives-deferred)): When wikilinks are enabled, autocomplete should output `[[file#slug|Original Heading]]` with the alias, not just the slug. Currently markdown links get the alias (`[Café y Niño](file.md#café-y-niño)`) but wikilinks don't (`[[file#café-y-niño]]` without `|Café y Niño`). See [TASK-1001](../tasks.md#task-1001-wikilink-aware-editor-suggestions-todo).
- **User-customizable link affixes** ([OBJ-010](../objectives.md)): Settings tab for prefix/suffix characters (e.g., `¶`, `§`) on generated links. See [TASK-1002](../tasks.md#task-1002-user-customizable-link-affixes-todo).

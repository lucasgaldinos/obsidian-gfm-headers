---
title: "Validation: Reveal Target (revealTargetInView)"
tags: [validation, reveal-target, applyScroll, setEphemeralState, highlight, scrolling]
description: "Mode × target-type validation matrix for the reveal mechanism. Covers applyScroll (Preview), setCursor+scrollIntoView (Source), manual is-flashing fallback, and mode-dependent failures for non-heading targets."
date_created: 2026-07-15
author: ["Lucas Galdino", "GitHub Copilot"]
plan_version: "2.0"
parent: "[[validation.md]]"
---

# Validation: Reveal Target (`revealTargetInView`)

> **Implementation category:** Layer 5 (Reveal Fallback) in the [5-layer architecture](../design.md#1-architecture-overview). The final step in both the ideal path (Virtual Block Injection delegates scrolling to Obsidian) and the fallback path (manual scroll for non-heading targets).
>
> **HTML anchor reveal failures (Bug 5):** The investigation plan and mode analysis below are preserved for v2. HTML anchor reveal in Source/Live Preview is deferred — see [Bug 5](../task-bugs.md#5-html-anchor-click-only-works-in-reading-mode--deferred-to-v2).

## What's Being Validated

[`reveal-target.ts`](../../../src/reveal-target.ts) provides `revealTargetInView(view, target)` — the manual scroll + highlight mechanism used when Virtual Block Injection is not applicable (HTML anchors, or when the ideal path somehow fails). It must:

1. **Detect the view mode** — Preview (`applyScroll`) vs Source (`editor.setCursor` + `scrollIntoView`).
2. **Scroll to the correct line** — `target.line` from `DocumentIndex`.
3. **Apply highlight** — `applyScroll(line, { highlight: true })` for Preview mode.
4. **Fallback to manual flashing** — if `applyScroll` doesn't trigger `.is-flashing`, manually add/remove the CSS class.
5. **Work across all three modes** — Reading, Live Preview, Source. (Currently fails for non-heading targets in Source/LP — see [Bug 10](../task-bugs.md#10-html-anchor-click-only-works-in-reading-mode).)

## Debug Events

| Event | When | Key payload |
| --- | --- | --- |
| `reveal:preview` | `applyScroll(line, {highlight: true})` called | `line`, `highlight` |
| `reveal:editor` | Editor scrolled (Source mode) | `line`, `mode` |
| `reveal:fallback` | Manual `is-flashing` fallback triggered | `line`, `reason` |
| `reveal:attempt` | **(to add for Bug 10)** Top of `revealTargetInView` | `line`, `mode`, `viewType` |

## Mode Behavior

| Mode | Scroll mechanism | Highlight mechanism | Works for headings? | Works for HTML anchors? |
| --- | --- | --- | --- | --- |
| Reading (Preview) | `mode.applyScroll(line, { highlight: true })` via `PreviewRendererLike` interface | Native `.is-flashing` CSS via `applyScroll` | ✅ | ✅ (DOM-based — forgiving) |
| Live Preview | `view.setEphemeralState({ line })` → `applyScroll` | Native `.is-flashing` | ✅ | ❌ [Bug 10](../task-bugs.md#10-html-anchor-click-only-works-in-reading-mode) |
| Source mode | `editor.setCursor({ line, ch: 0 })` + `editor.scrollIntoView()` | Manual `.is-flashing` fallback | ✅ | ❌ [Bug 10](../task-bugs.md#10-html-anchor-click-only-works-in-reading-mode) |

## Target Type Behavior

| Target type | Ideal path (Virtual Block) | Fallback path (revealTargetInView) |
| --- | --- | --- |
| `type: "heading"` | ✅ Used — native block navigation handles scroll + highlight | Not reached (heading targets go through ideal path) |
| `type: "html-anchor"` | Not applicable (only headings get virtual blocks) | ⚠️ Used — but fails in Source/LP modes |

## The Critical Question: Is This Really a Fallback?

From `reveal-target.ts` `[^obs-3a]`: "Is `revealTargetInView` really a fallback or the main mechanism?"

**Answer from code analysis:**

- For **heading targets** in the `openLinkText` interceptor: `revealTargetInView` is **NOT reached**. The ideal path (Virtual Block Injection → `#^gfm-click-{slug}`) delegates all scrolling/highlighting to Obsidian's native block navigation. The `revealTargetInView` call is in STEP 5 which is only reached for `type !== "heading"`.
- For **HTML anchor targets**: `revealTargetInView` IS the primary mechanism. There is no virtual block injection for anchor types.
- For **direct calls** (if any code calls `revealTargetInView` directly): it's the only mechanism.

**Verification procedure:**

1. Click a heading link → check console: do you see `reveal:preview` or `reveal:fallback`? You should NOT — the ideal path uses native block navigation.
2. Click an HTML anchor link in Reading mode → check console: you SHOULD see `reveal:fallback` — this confirms the fallback path is used.
3. Click an HTML anchor link in Source mode → check console: does `reveal:attempt` fire? Does `reveal:editor` fire? If neither, the function may not be reached or may fail silently.

## `applyScroll` Type Safety

The `applyScroll(line, { highlight: true })` overload is confirmed from decompiled Obsidian `app.js` but not declared in `obsidian.d.ts`. The plugin uses a local `PreviewRendererLike` interface with runtime cast:

```typescript
interface PreviewRendererLike {
  applyScroll(line: number, options?: { highlight?: boolean; center?: boolean }): void;
}
const mode = (view as any).previewMode as PreviewRendererLike | undefined;
```

**Verify:** In Reading mode, after clicking a link, confirm the heading line gets the `.is-flashing` CSS class (yellow background animation). If not, the `applyScroll` cast may be broken in the current Obsidian version.

## Known Bugs in This Category

| Bug | Description | Status |
| --- | --- | --- |
| [Bug 2](../task-bugs.md#2-highlighting-fails-still-goes-to-the-header) | `.is-flashing` not triggering after navigation | **Resolved** — Virtual Block Injection delegates to native block navigation |
| [Bug 10](../task-bugs.md#10-html-anchor-click-only-works-in-reading-mode) | `revealTargetInView` fails for HTML anchors in Source/LP | **Investigating** |

## Related Files

- [`src/reveal-target.ts`](../../../src/reveal-target.ts) — `revealTargetInView()`
- [`src/patch-workspace.ts`](../../../src/patch-workspace.ts) — STEP 5 (fallback path caller)

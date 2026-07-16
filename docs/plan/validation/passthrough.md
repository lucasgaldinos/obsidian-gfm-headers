---
title: "Validation: Passthrough & Guard Logic"
tags: [validation, passthrough, guard, gfm-detection, uppercase, url-encoded, block-ref]
description: "Validation matrix for the GFM guard logic — which links are correctly passed through to Obsidian's native handling vs intercepted for GFM resolution."
date_created: 2026-07-15
author: ["Lucas Galdino", "GitHub Copilot"]
plan_version: "2.0"
parent: "[[validation.md]]"
---

# Validation: Passthrough & Guard Logic

> **Implementation category:** Cross-cutting — the GFM guard in [`resolve-target.ts`](../../../src/resolve-target.ts) is the first decision point in both click navigation and hover preview. It determines whether the plugin owns the link or passes it through to Obsidian.

## What's Being Validated

The GFM guard in `resolveGfmTarget()` must correctly classify every link as either:

- **GFM slug** → plugin handles it (resolve, navigate, preview)
- **Passthrough** → plugin does nothing, Obsidian handles natively

The guard is:

```typescript
if (/[A-Z]/.test(slug) || /%[0-9A-Fa-f]{2}/.test(slug) || slug.startsWith("^") || slug.startsWith("[^")) {
  return { type: "passthrough", reason: "not-gfm" };
}
```

## Guard Rules

| Rule | Pattern | Rationale |
| --- | --- | --- |
| Uppercase detection | `/[A-Z]/` | GFM slugs are always lowercase. OFM preserves case, so uppercase = OFM. |
| URL-encoded detection | `/%[0-9A-Fa-f]{2}/` | GFM does not URL-encode. OFM URL-encodes special characters. |
| Block reference detection | `startsWith("^")` | Block references (`#^block-id`) are Obsidian's native block targeting. |
| Footnote detection | `startsWith("[^")` | Footnote references (`#[^fn]`) are Obsidian's native footnote system. |

## Passthrough Matrix

| Link | Slug extracted | Guard result | Reason | Verified? |
| --- | --- | --- | --- | --- |
| `[[file#Simple Heading]]` | `Simple Heading` | Passthrough | Uppercase `S`, `H` | ✅ |
| `[[file#My Heading]]` | `My Heading` | Passthrough | Uppercase `M`, `H` | ✅ |
| `[[file#my%20heading]]` (wikilink) | `my%20heading` | Passthrough | `%20` matches URL-encoded pattern | ✅ |
| `[text](file.md#my%20heading)` (markdown) | `my heading` (decoded by Obsidian!) | **GFM?** | No uppercase, no `%XX` — but has space | ⚠️ See [Bug 11](../task-bugs.md#11-url-encoded-passthrough-behavior-differs-by-link-format) |
| `[[file#^block-ref]]` | `^block-ref` | Passthrough | Starts with `^` | ✅ |
| `[[file#[^footnote]]]` | `[^footnote` | Passthrough | Starts with `[^` | ✅ |
| `[[file#my-heading]]` | `my-heading` | **GFM** | No uppercase, no `%XX`, no `^`, no `[^` | ✅ Handled by plugin |
| `[[file#café-y-niño]]` | `café-y-niño` | **GFM** | All lowercase, no URL-encoding | ✅ Handled by plugin |
| `[[file#my_variable_name]]` | `my_variable_name` | **GFM** | Underscores are GFM-legal | ✅ Handled by plugin |
| `[[file#commands-1]]` | `commands-1` | **GFM** | Collision suffix is GFM-legal | ✅ Handled by plugin |
| `https://obsidian.md` | N/A | N/A | No `#` in linktext — not intercepted at all | ✅ Bypasses interceptor |

## Format-Dependent Behavior (Markdown vs Wikilink)

A critical subtlety: Obsidian **pre-processes** markdown links differently from wikilinks before they reach `openLinkText`.

| Link format | Obsidian pre-processing | Slug our interceptor sees |
| --- | --- | --- |
| `[[file#my%20heading]]` | None — raw `my%20heading` preserved | `my%20heading` → passthrough |
| `[text](file.md#my%20heading)` | **Decodes `%20` → space** | `my heading` → space present → may pass guard |

This means the same logical target (`my heading`) behaves differently depending on link syntax. The markdown link version may be intercepted as GFM (since the `%XX` guard never sees the encoded form), while the wikilink version is correctly passed through.

## Silent Passthrough — Debug Output

Passthrough links produce **no console output** by design. The guard returns `{ type: "passthrough" }` before any `debugLog` call. This is intentional — passthrough links are not the plugin's responsibility.

The `debugLog("parse:passthrough", ...)` call exists but is only reached for slugs that:

1. Pass the guard (no uppercase, no `%XX`, no `^`, no `[^`)
2. But are NOT found in the DocumentIndex

This means: if a link has a valid-looking GFM slug that doesn't match any heading, you'll see `parse:passthrough` for "not-found" reason.

## Known Bugs in This Category

| Bug | Description | Status |
| --- | --- | --- |
| [Bug 9](../task-bugs.md#9-passthrough-links-produce-no-debug-output) | Silent passthrough is correct — not a bug | Verified — working as designed |
| [Bug 11](../task-bugs.md#11-url-encoded-passthrough-behavior-differs-by-link-format) | URL-encoded slugs decoded by Obsidian for markdown links before interception | Documented — surprising but consistent |

## Edge Cases to Test

| Scenario | Expected guard result | Notes |
| --- | --- | --- |
| Slug with space (`my heading`) | **GFM?** | Spaces are not in GFM spec. But `gfmSlugify` converts spaces to hyphens. A raw space in a slug means it wasn't generated by GFM — but the guard doesn't check for spaces. |
| Slug with trailing hyphen (`my-heading-`) | **GFM** | GFM-legal. Trimming is the author's responsibility. |
| Slug with consecutive hyphens (`my--heading`) | **GFM** | GFM-legal. `gfmSlugify` may or may not collapse these. |
| Empty slug (`#`) | **GFM?** | The `#` alone with no slug text. The guard doesn't reject empty strings. |
| Slug with emoji (`#😀`) | **GFM?** | No uppercase, no `%XX` — passes guard. But won't match any heading (emoji stripped by `gfmSlugify`). |

## Related Files

- [`src/resolve-target.ts`](../../../src/resolve-target.ts) — `resolveGfmTarget()` containing the guard
- [`src/gfm-slugify.ts`](../../../src/gfm-slugify.ts) — `gfmSlugify()` (generates the slugs we match against)
- [`src/patch-workspace.ts`](../../../src/patch-workspace.ts) — both `openLinkText` and `hover-link` call `resolveGfmTarget`

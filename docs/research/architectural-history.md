---
title: "Architecture History & Decisions"
tags: [architecture, research, history]
description: "Combined record of architecture questions, migration findings, and the historical migration plan."
---

# Architecture History & Decisions

This document unites the historical research and questions that led to the current GFM Heading Links architecture.

## 1. Core Architecture Problem

The original plugin implementation used an undocumented `Heading#Heading` subpath format to try to disambiguate duplicate headings. This proved unreliable because Obsidian's internal `resolveSubpath` function does not understand this syntax. This caused highlights to land on the wrong headings and navigation to fail.

To solve this, we needed a way to translate GFM slugs into native Obsidian targets.

## 2. Approaches Considered and Rejected

### A. Proxy-on-`getFileCache` (Rejected)

**Hypothesis:** Monkeypatch `MetadataCache.getFileCache()` to return a Proxy that rewrites `cache.headings[].heading` text to GFM slugs.
**Why it failed:** `openLinkText` is `async` and yields execution. During this yield, other plugins and Obsidian core components (Outline, Graph, Backlinks) calling `getFileCache` would receive corrupted heading text. javascript's single-threaded nature means we cannot safely scope a monkeypatch across `await` boundaries.

### B. Injecting a Custom Cache Field (Rejected)

**Hypothesis:** Add a `gfmLinks` field to the cache object returned by `getFileCache`.
**Why it failed:** While safe (Obsidian ignores unknown fields), it ran on *every* cache read, making it perform poorly for large vaults. It also tight-coupled our plugin to Obsidian's cache lifecycle.

### C. DOM-Based Interception (Rejected)

**Hypothesis:** Rewrite anchor `href` attributes in the DOM using a CM6 `ViewPlugin` and a `MarkdownPostProcessor`, then intercept clicks.
**Why it failed:** Adds significant complexity (~400 lines of code), requires managing two separate rendering pipelines, and often loses the native `is-flashing` highlight animation.

## 3. The Accepted Solution: Document Index + Virtual Block Injection

We settled on a fully decoupled approach that keeps the plugin under 300 lines:

1. **Standalone Document Index**: Build a lazy `Map<gfmSlug, {line, heading, position}>` per file, completely separate from Obsidian's cache.
2. **`openLinkText` Monkeypatch**: Intercept navigation. Instead of relying on `resolveSubpath`, look up the line number/position in our own index.
3. **Virtual Block Injection**: To natively highlight the entire heading section, inject a temporary block into Obsidian's cache (`#^gfm-click-<slug>`), route `openLinkText` to this block, and then remove the virtual block 1500ms later.

This approach successfully handles duplicates, preserves native animations, and avoids global cache corruption.

## 4. Release Infrastructure (v1.3.0 — 2026-07-18)

### Branch Strategy: Production vs Development

To keep debug logging out of production builds while preserving it for development, the repository uses a two-branch strategy:

| Branch | `DEBUG_ENABLED` | Purpose |
|--------|-----------------|---------|
| `main` | `false` | Production — clean console, tagged releases |
| `dev` | `true` | Development — full diagnostic logging |

The `DEBUG_ENABLED` flag lives in `src/debug.ts` as a single boolean constant. All diagnostic output flows through the `debugLog()` function, which is a no-op when disabled. This gives us a single toggle point rather than scattered `console.log` calls throughout the codebase.

### CI/CD: GitHub Actions Release Workflow

Releases are automated via `.github/workflows/release.yml`:

1. Push a git tag matching `manifest.json` version (e.g., `git tag -a 1.3.0`)
2. GitHub Actions spins up an Ubuntu runner, runs `npm install && npm run build`
3. Creates a draft GitHub Release with `main.js`, `manifest.json`, and `styles.css` as attachments
4. Release is manually reviewed and published via GitHub UI

**Decision: GitHub Actions over manual releases.** The Obsidian Community Directory reads from GitHub Releases — each release must have the correct binary attachments. Automating this eliminates human error (forgetting to upload a file, misnaming the tag). Cost: $0 for public repositories (unlimited CI minutes).

### Community Directory Compliance

The [Obsidian submission requirements](<file:///home/lucas_galdino/.agents/skills/obsidian/obsidian-plugins/references/Plugins/Releasing/Submission%20requirements%20for%20plugins.md>) mandate:
- `LICENSE` file at repo root (MIT chosen, matching `package.json`)
- `manifest.json` with populated `author` and `authorUrl`
- Plugin description ≤250 chars, ending with period, no emoji
- No `fundingUrl` unless accepting donations (omitted)
- `minAppVersion` set to minimum compatible Obsidian version (`1.12.7` for dual settings API support)
- `isDesktopOnly: false` (no Node.js/Electron APIs used)

### Automated Review Linter — Lessons Learned (v1.3.1, 2026-07-20)

After submitting to the community directory, Obsidian's automated review linter reported
several warnings not visible in local development. The fixes required 6 iterations (later
squashed into a single v1.3.1 release). Key lessons:

1. **No `any` types or directive suppressions**: The linter rejects `@typescript-eslint/no-explicit-any`
   and `eslint-disable` comments. Every `any` must be replaced with a proper interface or type
   guard. This forced the creation of `vault-config.ts`, `SuggestionValue`/`EditorSuggestInstance`
   interfaces, and `unwrapDropdownItem()` type guard.

2. **`this: void` on detached methods**: Methods captured from Obsidian internals
   (`workspace.openLinkText`, `workspace.trigger`) trigger `this`-scoping warnings. Arrow
   functions alone are insufficient — the method must be bound at capture time:
   `const fn = workspace.openLinkText.bind(workspace)`.

3. **`console.log` banned**: Even inside gated `if (DEBUG_ENABLED)` blocks, `console.log` is
   rejected. `console.debug` is accepted and semantically appropriate (suppressed at
   default DevTools log level).

4. **`window.setTimeout` required**: Bare `setTimeout`/`clearTimeout` references are flagged.
   Must use `window.setTimeout`/`window.clearTimeout` for browser global compliance.

5. **Tag format matters**: Obsidian requires exact match between `manifest.json` version and
   git tag. Tags like `v1.3.1` are rejected — must be `1.3.1` without prefix.

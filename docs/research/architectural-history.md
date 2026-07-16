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

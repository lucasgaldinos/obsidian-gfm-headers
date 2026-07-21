---
title: "GFM heading links architecture plan"
tags: [architecture, implementation-plan, obsidian-plugin, gfm-heading-links, solid]
description: "Unified architecture for deterministic GFM heading navigation, autocomplete, and Page Preview in Obsidian."
date_created: 2026-07-08
date_changed: 2026-07-20
author: ["Lucas Galdino", "GitHub Copilot"]
goal: "Implement a unified, deterministic architecture for GFM-style heading and anchor navigation in Obsidian"
version: "2.0"
status: "v1.3.1 released — community review compliance complete. main (DEBUG_ENABLED=false, production), dev (DEBUG_ENABLED=true, development)."
---

> [!tip] Plan status: v1.3.1 released. Community review compliance complete. 48 tests passing, build clean.
>
> **Branch strategy:** `main` (production, DEBUG_ENABLED=false) • `dev` (development, DEBUG_ENABLED=true). Release workflow auto-builds on tag push via GitHub Actions with artifact attestations.
>
> v1.3.1 features: release infrastructure (LICENSE, CI/CD, branch strategy), community directory review compliance (eliminated all `any` types, `this: void` linter warnings, `console.log` in production), artifact attestations for supply-chain provenance.
>
> See [tasks.md](./tasks.md#phase-13-community-review-compliance) for review compliance tasks.

# GFM heading links architecture plan

This is the high-level overview. Detailed specifications are split across:

| Document | Contents |
| --- | --- |
| [**objectives.md**](./objectives.md) | 8 objectives, v1 scope table, 7 architecture decisions with rationale |
| [**design.md**](./design.md) | `openLinkText` workflows (unpatched, patched, new), why DocumentIndex over `getFileCache`, 5-layer unified architecture |
| [**tasks.md**](./tasks.md) | 7 phases, 24 tasks with dependency graphs, parallel opportunities, verification steps |
| [**validation.md**](./validation/validation.md) | 15-scenario × 3-mode validation matrix, 14 debug event types, expected console traces |
| [**files.md**](./files.md) | 15 files expected to change, 6 risk mitigations |

## Problem

The current `#Heading#Heading` subpath format for duplicate heading targeting is **speculative** — Obsidian's `resolveSubpath()` does not understand it. GFM slugs (lowercase, kebab-case) are fundamentally incompatible with Obsidian's internal `stripHeading()` normalization.

## Solution

**Document Index + `applyScroll`**: Build a lazy `Map<gfmSlug, {line, heading}>` per file. On click: resolve slug to line number, strip the hash, call `openLinkText` (preserving modifier keys), then manually scroll via `applyScroll(line, {highlight: true})` for native flashing.

### 5-Layer Unified Architecture

1. **Document Indexer** → [TASK-0103](./tasks.md#task-0103-build-document-index-in-srcdocument-indexts-done)
2. **Router Monkeypatch** (`openLinkText`) → [TASK-0401](./tasks.md#task-0401-update-openlinktext-interceptor-done)
3. **Autocomplete Monkeypatch** (`EditorSuggest.selectSuggestion`) → [TASK-0404](./tasks.md#task-0404-implement-autocomplete-monkeypatch-done)
4. **Hover Monkeypatch** (`trigger('hover-link')`) → [TASK-0403](./tasks.md#task-0403-update-triggerhover-link-interceptor-done)
5. **Reveal Layer** (`revealTargetLine`) → [TASK-0301](./tasks.md#task-0301-implement-srcreveal-targetts-done)

## Related research

- [Architecture History & Decisions](../research/architectural-history.md)
- [GFM Spec & Plugin Comparisons](../research/gfm-spec-and-comparisons.md)

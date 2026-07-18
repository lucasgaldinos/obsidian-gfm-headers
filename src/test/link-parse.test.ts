/**
 * Unit Tests for `normalizeSlug()` — Link Parsing & Normalization Layer.
 *
 * These tests verify the slug normalization pipeline that pre-processes raw
 * link slugs before they enter the resolution engine. The normalization layer
 * handles URL decoding and cosmetic affix stripping (prefix/suffix characters
 * applied during autocomplete).
 *
 * ## Test categories
 *
 * 1. **URL decoding** — Defensive decodeURIComponent for encoded slugs.
 * 2. **Prefix stripping** — User-configured prefix character removal.
 * 3. **Suffix stripping** — User-configured suffix character removal.
 * 4. **Combined affix stripping** — Both prefix and suffix together.
 * 5. **Passthrough** — No settings or no matching affixes → slug unchanged.
 * 6. **Degenerate inputs** — Empty strings, special characters, partial matches.
 *
 * Created for v1.3 (TASK-1011).
 */

import { describe, it, expect } from "vitest";
import { normalizeSlug } from "../link-parse";
import type { GfmSettings } from "../settings";

describe("normalizeSlug", () => {
    // ─── URL Decoding ───

    it("decodes URL-encoded spaces (%20)", () => {
        expect(normalizeSlug("my%20heading")).toBe("my heading");
    });

    it("decodes URL-encoded hyphens (%2D)", () => {
        expect(normalizeSlug("my%2Dheading")).toBe("my-heading");
    });

    it("handles already-decoded slugs (idempotent)", () => {
        expect(normalizeSlug("my-heading")).toBe("my-heading");
    });

    it("handles malformed URL encoding gracefully", () => {
        // decodeURIComponent throws on malformed % sequences
        expect(normalizeSlug("bad%ZZencoding")).toBe("bad%ZZencoding");
    });

    // ─── Prefix Stripping ───

    it("strips prefix character", () => {
        const settings: GfmSettings = { prefix: "§", suffix: "", enableWikilinkAlias: true };
        expect(normalizeSlug("§my-heading", settings)).toBe("my-heading");
    });

    it("strips multi-character prefix", () => {
        const settings: GfmSettings = { prefix: ">>>", suffix: "", enableWikilinkAlias: true };
        expect(normalizeSlug(">>>my-heading", settings)).toBe("my-heading");
    });

    it("does not strip prefix if slug doesn't start with it", () => {
        const settings: GfmSettings = { prefix: "§", suffix: "", enableWikilinkAlias: true };
        expect(normalizeSlug("my-heading", settings)).toBe("my-heading");
    });

    // ─── Suffix Stripping ───

    it("strips suffix character", () => {
        const settings: GfmSettings = { prefix: "", suffix: "¶", enableWikilinkAlias: true };
        expect(normalizeSlug("my-heading¶", settings)).toBe("my-heading");
    });

    it("strips multi-character suffix", () => {
        const settings: GfmSettings = { prefix: "", suffix: "<<<", enableWikilinkAlias: true };
        expect(normalizeSlug("my-heading<<<", settings)).toBe("my-heading");
    });

    it("does not strip suffix if slug doesn't end with it", () => {
        const settings: GfmSettings = { prefix: "", suffix: "¶", enableWikilinkAlias: true };
        expect(normalizeSlug("my-heading", settings)).toBe("my-heading");
    });

    // ─── Combined Prefix + Suffix ───

    it("strips both prefix and suffix together", () => {
        const settings: GfmSettings = { prefix: "§", suffix: "¶", enableWikilinkAlias: true };
        expect(normalizeSlug("§my-heading¶", settings)).toBe("my-heading");
    });

    it("handles prefix-only when suffix doesn't match", () => {
        const settings: GfmSettings = { prefix: "§", suffix: "¶", enableWikilinkAlias: true };
        expect(normalizeSlug("§my-heading", settings)).toBe("my-heading");
    });

    it("handles suffix-only when prefix doesn't match", () => {
        const settings: GfmSettings = { prefix: "§", suffix: "¶", enableWikilinkAlias: true };
        expect(normalizeSlug("my-heading¶", settings)).toBe("my-heading");
    });

    // ─── Passthrough (No Settings) ───

    it("passes through when no settings provided", () => {
        expect(normalizeSlug("my-heading")).toBe("my-heading");
    });

    it("passes through with empty prefix/suffix settings", () => {
        const settings: GfmSettings = { prefix: "", suffix: "", enableWikilinkAlias: true };
        expect(normalizeSlug("my-heading", settings)).toBe("my-heading");
    });

    // ─── Degenerate Inputs ───

    it("handles empty slug", () => {
        expect(normalizeSlug("")).toBe("");
    });

    it("handles slug that is only the prefix", () => {
        const settings: GfmSettings = { prefix: "§", suffix: "", enableWikilinkAlias: true };
        expect(normalizeSlug("§", settings)).toBe("");
    });

    it("handles slug that is only the suffix", () => {
        const settings: GfmSettings = { prefix: "", suffix: "¶", enableWikilinkAlias: true };
        expect(normalizeSlug("¶", settings)).toBe("");
    });

    it("does not strip prefix from middle of slug", () => {
        const settings: GfmSettings = { prefix: "§", suffix: "", enableWikilinkAlias: true };
        expect(normalizeSlug("my-§-heading", settings)).toBe("my-§-heading");
    });
});

/**
 * Typed accessor for Obsidian's internal Vault configuration.
 *
 * Obsidian's `Vault` class stores user preferences (like "Use [[wikilinks]]")
 * in a private `config` object accessed via `getConfig(key)`. This method is
 * not exposed in the public TypeScript API, so all callers must cast through
 * `any`. This module encapsulates that cast in a single, well-documented
 * location to minimize `any` proliferation throughout the codebase.
 *
 * ## Why not use `(vault as any).getConfig` everywhere?
 *
 * Scattering `as any` casts creates undocumented coupling points. If Obsidian
 * changes the internal config API, every call site breaks silently. By routing
 * all config access through this helper, there is exactly one place to update.
 */
import type { Vault } from "obsidian";

/**
 * Retrieves a user configuration value from Obsidian's internal vault config.
 *
 * This is an intentional escape hatch — Obsidian does not provide a public
 * API for reading vault-level settings. The `getConfig` method exists on the
 * Vault prototype but is absent from the TypeScript declarations.
 *
 * @param vault - The plugin's Vault instance (`plugin.app.vault`).
 * @param key - The configuration key (e.g., `"useMarkdownLinks"`).
 * @returns The config value, or `undefined` if the key is not found.
 */
export function getVaultConfig(vault: Vault, key: string): unknown {
    return (vault as unknown as { getConfig?: (key: string) => unknown }).getConfig?.(key);
}

/**
 * Returns whether the user has enabled wikilinks (`[[link]]`) in Obsidian
 * settings. When false, the user prefers markdown links (`[text](url)`).
 *
 * This is a convenience wrapper around `getVaultConfig` for the most
 * commonly accessed configuration key in this plugin.
 */
export function isWikilinksEnabled(vault: Vault): boolean {
    const config = getVaultConfig(vault, "useMarkdownLinks");
    // "useMarkdownLinks": true → markdown links → wikilinks disabled
    // "useMarkdownLinks": false → wikilinks enabled
    // undefined (e.g., older Obsidian) → default to markdown links
    return config === false;
}

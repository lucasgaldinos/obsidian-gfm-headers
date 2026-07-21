/**
 * Debug Logging Utility for GFM Heading Links Plugin.
 *
 * This module provides a centralized, toggleable logging system that wraps
 * the browser's native `console.log`. Instead of sprinkling raw `console.log`
 * calls throughout the codebase — which would be a nightmare to strip out
 * for production releases — all diagnostic output is funneled through this
 * single module.
 *
 * ## Why this exists
 *
 * Obsidian plugins run in a sandboxed iframe environment where `console.log`
 * is available, but there's no built-in logging level control. This module
 * gives us a single kill-switch (`DEBUG_ENABLED`) to silence all plugin noise
 * when shipping to users, while keeping verbose instrumentation available
 * during development.
 *
 * ## Usage
 *
 * ```ts
 * import { debugLog, DEBUG_ENABLED } from "./debug";
 *
 * debugLog("reveal:preview-virtual-block", { originalSlug: "my-heading", virtualId: "gfm-my-heading" });
 * // Output: [GFM Heading Links] reveal:preview-virtual-block { originalSlug: "my-heading", virtualId: "gfm-my-heading" }
 *
 * debugLog("cache:hit", "file.md");
 * // Output: [GFM Heading Links] cache:hit file.md
 * ```
 *
 * ## Design Decision
 *
 * We use a simple boolean flag rather than log levels (DEBUG, INFO, WARN, ERROR)
 * because the primary goal is a binary "development vs. production" switch.
 * Obsidian's Developer Console already filters by level if needed.
 *
 * The `[GFM Heading Links]` prefix ensures our logs are easily distinguishable
 * from Obsidian's own verbose internal logging and any other plugins' output.
 */

/**
 * Master kill-switch for all plugin diagnostic output.
 *
 * Set to `true` during development to see detailed instrumentation of every
 * intercepted event, cache operation, and slug resolution. Set to `false`
 * before merging to main or publishing a release so that end-users don't
 * get their console flooded with noise they don't understand and don't need.
 *
 * In a more sophisticated setup, this could be wired to a plugin setting
 * toggle in Obsidian's settings UI, but a compile-time constant is simpler
 * and avoids runtime overhead for a check that almost never changes.
 */
export const DEBUG_ENABLED = true;

/**
 * Conditionally logs a diagnostic event to the browser console.
 *
 * This is the single point of entry for all plugin logging. Every module
 * that needs to emit diagnostic information calls this function instead
 * of `console.log` directly. When `DEBUG_ENABLED` is `false`, the function
 * body is essentially a no-op (though JavaScript will still evaluate the
 * arguments — a trade-off we accept for simplicity).
 *
 * ## How it works
 *
 * 1. The function first checks the `DEBUG_ENABLED` flag. If logging is
 *    disabled, it returns immediately without touching the console.
 * 2. If enabled, it formats the message with our standard `[GFM Heading Links]`
 *    prefix so every log line is clearly attributable to this plugin.
 * 3. If an optional `payload` argument is provided (object, string, number,
 *    etc.), it is passed as a second argument to `console.log`, which allows
 *    the browser's DevTools to display objects as expandable trees rather
 *    than flattened strings.
 *
 * ## Why not use a proper logging library?
 *
 * Because Obsidian plugins are bundled into a single file by esbuild, and
 * every kilobyte matters when loading on mobile devices. A full logging
 * framework with log levels, formatters, and transports would be overkill
 * for a plugin of this size. This 10-line function does everything we need.
 *
 * @param event - A short, dot-separated identifier for the event being logged.
 *                Convention: use `category:subcategory` format, e.g.:
 *                - `"cache:hit"` / `"cache:miss"`
 *                - `"reveal:start"` / `"reveal:complete"`
 *                - `"patch:openLinkText"` / `"patch:hover-link"`
 *                - `"slug:generated"`
 *                This convention makes it easy to grep logs for specific subsystems.
 * @param payload - Optional. Any JSON-serializable value to attach as contextual
 *                  data. Objects are preferred because DevTools renders them
 *                  as interactive trees. Pass `undefined` (or omit) for
 *                  simple event-only messages.
 *
 * @example
 * // Event-only log (no payload)
 * debugLog("cache:invalidated");
 * // Console: [GFM Heading Links] cache:invalidated
 *
 * @example
 * // Event with structured payload
 * debugLog("resolve:success", {
 *   slug: "my-heading",
 *   file: "notes/example.md",
 *   line: 42,
 *   type: "heading"
 * });
 * // Console: [GFM Heading Links] resolve:success ▶ { slug: "my-heading", file: "notes/example.md", line: 42, type: "heading" }
 */
export function debugLog(event: string, payload?: any) {
    if (DEBUG_ENABLED) {
        if (payload !== undefined) {
            console.log(`[GFM Heading Links] ${event}`, payload);
        } else {
            console.log(`[GFM Heading Links] ${event}`);
        }
    }
}

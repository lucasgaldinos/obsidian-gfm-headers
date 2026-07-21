/**
 * Target Reveal — Manual Scrolling and Highlighting Fallback.[^obs-3a]
 *
 * [^obs-3a]:>[!warning] Question about fallback.
 *       >!FIX Is this really a fallback or the main mechanism right now? must validate If the behavior is working is being done as expected. And validate the manual scrolling. What is being called? In which case the "Ideal path" is being called? And when is the "Fallback path" being called? Are they being executed as they should? The user should be doing the validation with an md example at the `test_vault`.
 *       >
 *       >Worth noting that a better file organization system and adherence to design system principles for the current implementation must be done. Must also implement under restrict restrict notice of the user, by using #askQuestions tool.
 *
 * This module provides the **fallback** mechanism for navigating to a resolved target when the primary mechanism (virtual block injection) is not applicable.
 *
 * ## When is this fallback used?
 *
 * The primary navigation strategy in `patch-workspace.ts` works like this:
 *
 * 1. **Ideal path**: Inject a temporary virtual block into `cache.blocks`,then call Obsidian's native `openLinkText`. Obsidian sees the virtualblock, scrolls to it, and highlights it — all natively. Clean.
 *
 * 2. **Fallback path** (this module): If the target is an HTML anchor (not a heading), we can't use virtual block injection because HTML anchors don't have proper section positions. Instead, we open the file without a hash, then manually scroll the view to the target line.
 *
 * ## The two-step reveal
 *
 * The fallback performs two distinct operations:
 *
 * 1. **`setEphemeralState({ line })`** — Sets the cursor position without modifying the editor history (hence "ephemeral"). This moves the cursor to the target line, which automatically scrolls the viewport if needed.
 *
 * 2. **`applyScroll(line, { center, highlight })`** — Explicitly triggers the native scroll-and-highlight animation. The `center: true` option vertically centers the target line in the viewport. The `highlight: true` option triggers Obsidian's yellow flash animation (the same effect you see when clicking a native heading link).
 *
 * ## Why not always use this instead of virtual block injection?
 *
 * Virtual block injection is preferred because:
 * - It integrates with Obsidian's native link history (back/forward navigation).
 * - It works seamlessly with the "page preview" hover feature.
 * - It's more reliable for cross-file navigation (Obsidian handles the file opening and view creation).
 *
 * This manual approach is a fallback that only handles the "already have the view open" case.
 */

import { View, MarkdownView } from "obsidian";
import type { AnchorTarget } from "./types";

/**
 * Programmatically scrolls a MarkdownView to a specific target and triggers Obsidian's native highlight animation.
 *
 * ## How Obsidian's scroll system works
 *
 * Obsidian's editor has an internal `applyScroll` method on the current mode (which could be "source mode" or "preview/reading mode"). This method accepts a line number and options:
 *
 * ```ts
 * mode.applyScroll(lineNumber, { center: true, highlight: true });
 * ```
 *
 * - `center: true` — Vertically centers the target line in the viewport. Without this, the line might be at the very top or bottom, which is disorienting for navigation.
 *
 * - `highlight: true` — Triggers the yellow flash animation on the target line. This is the same visual effect Obsidian uses for native link navigation, providing consistency in the user experience.
 *
 * ## Why we access `currentMode` as `any`
 *
 * Obsidian's TypeScript definitions don't expose the `applyScroll` method on the mode objects. It's an internal API. We cast to `any` to bypass TypeScript's type checking. If Obsidian removes or renames this method in a future update, the call will silently fail (we guard with the `typeof` check), and the user will at least have the cursor moved to the right line via `setEphemeralState`.
 *
 * ## The `setEphemeralState` call
 *
 * Before scrolling, we set the ephemeral state to the target line:
 * ```ts
 * view.setEphemeralState({ line: target.line });
 * ```
 *
 * "Ephemeral state" is Obsidian's mechanism for temporary editor state that doesn't persist in the document history. It's used internally for things like "go to heading" navigation. Setting it moves the cursor to the specified line without creating an undo history entry.
 *
 * ## What about HTML anchors?
 *
 * HTML anchors (`<a id="...">`) don't have a proper "section" — they're single-line elements. The `target.line` for an HTML anchor points to the line containing the `<a>` tag. When we scroll there, the user sees the anchor element itself, which may not have visible content. This is a known limitation — ideally we'd scroll to the content AFTER the anchor, but determining where that content starts is complex and not implemented.
 *
 * @param view - The Obsidian View (must be a MarkdownView) to scroll.
 *               If it's not a MarkdownView, the function is a no-op.
 * @param target - The resolved anchor target containing at minimum a `line`
 *                 number. Both heading and HTML anchor targets work.
 *
 * @example
 * ```ts
 * const view = app.workspace.getActiveViewOfType(MarkdownView);
 * if (view) {
 *   revealTargetInView(view, { type: "heading", line: 42, ... });
 *   // The editor scrolls to line 42 with a yellow highlight flash
 * }
 * ```
 */
export function revealTargetInView(view: View, target: AnchorTarget) {
    // GUARD: Only operate on MarkdownView instances. Other view types (graph view, canvas, etc.) don't have the scrolling API we need. Silently ignore them.
    if (view instanceof MarkdownView) {
        // STEP 1: Set the cursor/scroll position without modifying history. This is a lightweight operation that Obsidian uses internally for navigation. It moves the cursor to the target line and scrolls the viewport to make it visible.
        view.setEphemeralState({ line: target.line });

        // STEP 2: Trigger the native highlight animation. We access the current editor mode (source mode or reading mode). The mode object has an `applyScroll` method that handles the smooth scrolling and yellow flash effect.
        const mode = view.currentMode as { applyScroll?: (line: number, opts: { center: boolean; highlight: boolean }) => void } | null;

        // Check that applyScroll exists before calling it. This guards against future Obsidian versions that may rename or remove this internal method.
        if (mode && typeof mode.applyScroll === "function") {
            // Center the target line vertically in the viewport and apply the yellow highlight flash. This matches Obsidian's native behavior when clicking a [[#heading]] link.
            //
            // Note: We reverted from using a range to calling with a single line. The previous attempt to highlight an entire section range caused visual glitches. Highlighting only the header line is simpler and matches the native Obsidian behavior.
            mode.applyScroll(target.line, { center: true, highlight: true });
        }
    }
}

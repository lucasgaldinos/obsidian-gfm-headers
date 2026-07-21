/**
 * Minimal Obsidian API Mocks for Unit Testing.
 *
 * This file provides stripped-down mock implementations of Obsidian's core  classes (`TFile`, `Plugin`) for use in Vitest unit tests.
 *
 * ## Why we need mocks
 *
 * Obsidian plugins run inside Obsidian's Electron/Chromium environment and  have access to the full `obsidian` module. When running unit tests with  Vitest (which runs in Node.js), the `obsidian` module is NOT available.
 *
 * We could mock the entire `obsidian` module with `vi.mock("obsidian", ...)`,  but that would require implementing dozens of classes and methods that we  don't use. Instead, we provide ONLY the classes that our code actually  imports from `obsidian`:
 *
 * - **`TFile`**: Used in type guards (`instanceof TFile`) and as a data container  for file paths. Our code only accesses `file.path`.
 *
 * - **`Plugin`**: Used as a base class for `GfmHeadingLinksPlugin`. Our tests  don't instantiate the real plugin — they use a hand-crafted mock object  (see `resolve-target.test.ts`).
 *
 * ## What's NOT mocked
 *
 * These mocks intentionally omit:
 * - `MarkdownView`, `Workspace`, `Vault`, `MetadataCache` — our tests use  hand-crafted plain objects instead (more flexible, less maintenance).
 * - `CachedMetadata`, `HeadingCache`, `Pos` — our tests construct minimal  objects with only the needed fields and cast `as any`.
 *
 * ## Usage
 *
 * In test files that import from `obsidian`, Vitest must be configured to  resolve `obsidian` to this mock file. This is configured in `vitest.config.ts`:
 *
 * ```ts
 * // vitest.config.ts
 * export default defineConfig({
 *   resolve: {
 *     alias: {
 *       obsidian: path.resolve(__dirname, "src/test/__mocks__/obsidian.ts")
 *     }
 *   }
 * });
 * ```
 *
 * ## When to expand these mocks
 *
 * Add new mock classes/properties when:
 * - A new source file imports a new Obsidian class.
 * - An existing test needs access to a property that isn't mocked yet.
 * - A type guard (`instanceof`) check is added against a new Obsidian class.
 *
 * Keep mocks minimal — only add what's actually used. Over-mocking leads to tests that pass with incorrect mock behavior and fail in production.
 */

/**
 * Mock implementation of Obsidian's `TFile` class.
 *
 * In the real Obsidian API, `TFile` extends `TAbstractFile` and contains numerous properties (stat, vault, extension, basename, etc.). Our plugin only uses `file.path` and `instanceof TFile` checks, so we mock only those.
 *
 * ## Why `path` has a default value
 *
 * In tests, we often create `new TFile()` without arguments. The default path `"mocked/path.md"` ensures that `file.path` is never `undefined`, preventing accidental errors in test assertions.
 */
export class TFile {
    /**
     * The vault-relative path of this file.
     * Defaults to a recognizable mock path so test failures are easy to diagnose.
     */
    path: string = "mocked/path.md";
}

/**
 * Mock implementation of Obsidian's `Plugin` class.
 *
 * Our tests don't instantiate this class directly — instead, they create
 * hand-crafted mock objects matching the `GfmHeadingLinksPlugin` interface.
 * This class exists so that TypeScript imports of `Plugin` from `obsidian`
 * resolve successfully during test compilation.
 *
 * ## What's intentionally omitted
 *
 * The real `Plugin` class has methods like `onload()`, `onunload()`,
 * `registerEvent()`, `addCommand()`, `addSettingTab()`, etc. We don't mock
 * any of these because our tests never call them on a `Plugin` instance.
 *
 * If a future test needs to instantiate the real `GfmHeadingLinksPluginImpl`
 * and call `onload()`, this mock would need to be expanded significantly.
 */
export class Plugin {
    /**
     * Reference to the Obsidian App instance.
     * In tests, this is always a hand-crafted mock object, not a real App.
     */
    app: any;

    /**
     * The plugin manifest (from manifest.json).
     * Not used in any current tests, but included for interface completeness.
     */
    manifest: any;
}

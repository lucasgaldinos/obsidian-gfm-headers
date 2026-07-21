# Bug Tracker

- [Bug Tracker](#bug-tracker)
  + [Session 1](#session-1)
    - [1. Hover Preview fails ("hovering can't find" / "links nowhere") — resolved](#1-hover-preview-fails-hovering-cant-find--links-nowhere--resolved)
    - [2. Highlighting fails ("still goes to the header") — resolved](#2-highlighting-fails-still-goes-to-the-header--resolved)
    - [3. Autocomplete not working ("not even recognizing links") — resolved](#3-autocomplete-not-working-not-even-recognizing-links--resolved)
  + [Session 2 (Post-DevTools Analysis)](#session-2-post-devtools-analysis)
    - [1. Hover Preview ("links nowhere") — resolved](#1-hover-preview-links-nowhere--resolved)
    - [2. Autocomplete — resolved](#2-autocomplete--resolved)
    - [2.1 Autocomplete: Alias Loss \& Missing Duplicate Suffixes — resolved](#21-autocomplete-alias-loss--missing-duplicate-suffixes--resolved)
    - [3. Highlighting (Section vs Header) — resolved](#3-highlighting-section-vs-header--resolved)
    - [4. Page Preview (`hover-link`) Not Triggering — resolved](#4-page-preview-hover-link-not-triggering--resolved)
    - [5. Architectural Caveats — resolved](#5-architectural-caveats--resolved)
  + [Session 3 (Validation Matrix Testing — 2026-07-14)](#session-3-validation-matrix-testing--2026-07-14)
    - [1. HTML Anchor Hover Inconsistency — deferred to v2](#1-html-anchor-hover-inconsistency--deferred-to-v2)
    - [2. Editor Suggest Preserves Raw HTML in Heading Text — resolved](#2-editor-suggest-preserves-raw-html-in-heading-text--resolved)
    - [3. GFM Collision Suffix Ambiguity (The "Commands" Problem) — resolved](#3-gfm-collision-suffix-ambiguity-the-commands-problem--resolved)
    - [4. Passthrough Links Produce No Debug Output — resolved](#4-passthrough-links-produce-no-debug-output--resolved)
    - [5. HTML Anchor Click Only Works in Reading Mode — deferred to v2](#5-html-anchor-click-only-works-in-reading-mode--deferred-to-v2)
    - [6. URL-Encoded Passthrough Behavior Differs by Link Format — resolved](#6-url-encoded-passthrough-behavior-differs-by-link-format--resolved)

## Session 1

This document serves as an overall register of bugs identified during testing, what was attempted to fix them, and the final resolution.

### 1. Hover Preview fails ("hovering can't find" / "links nowhere") — resolved

> **Task:** [TASK-0403](tasks.md#task-0403-update-triggerhover-link-interceptor-done) — `trigger('hover-link')` interceptor. **Validation:** [`hover-preview.md`](validation/hover-preview.md).

- **Resolution**: `buildDocumentIndex` was passed `cache.headings` instead of `cache`, producing an empty index. Corrected to `buildDocumentIndex(cache)`. See [Session 2, Bug 1](#1-hover-preview-links-nowhere--resolved) for the fix.
- **Original Issue**: Hovering over a GFM link produced a "links nowhere" tooltip. Console showed timeout warnings (`[Violation] 'setTimeout' handler took 68ms`).
- **Probable Cause Candidates**:
  1. The calculation logic `Math.max(heading.position.start.line, endLine)` is incorrect.
      - [x] (Attempt 1: Replaced logic to use exact byte offsets for `position`. Result: Failed)
  2. Obsidian's block reference regex rejects the virtual block ID `gfm-${decodedSlug}` due to invalid characters like underscores.
      - [x] (Attempt 2: Altered to generate a random, purely alphanumeric block ID. Result: Failed. The hover preview still fails to recognize the virtual block injection)

### 2. Highlighting fails ("still goes to the header") — resolved

> **Tasks:** [TASK-0301](tasks.md#task-0301-implement-srcreveal-targetts-done) — `revealTargetInView`, [TASK-0401](tasks.md#task-0401-update-openlinktext-interceptor-done) — Virtual Block Injection. **Validation:** [`reveal-target.md`](validation/reveal-target.md), [`click-navigation.md`](validation/click-navigation.md).

- **Resolution**: Virtual Block Injection (`#^gfm-click-{slug}`) delegates all scrolling and highlighting to Obsidian's native block navigation, which natively triggers `.is-flashing` on the entire section. See [Session 2, Bug 3](#3-highlighting-section-vs-header--resolved) for the fix.
- **Issue**: Clicking a link navigated to the correct line, but the expected native `.is-flashing` background highlight did not occur.
- **Probable Cause Candidates**:
  1. `setEphemeralState({ line: target.line })` does not trigger highlight correctly.
      - [x] (Attempt 1: Replaced with a direct call to `mode.applyScroll(target.line, { center: true, highlight: true })`. Result: Failed. The flash did not occur natively)
  2. Race condition where `applyScroll` fired synchronously before the view DOM had fully rendered.
      - [x] (Attempt 2: Added a polling loop `tryHighlight` with a 50ms `setTimeout` waiting for `.is-flashing`. Result: Failed. The polling mechanism did not trigger the expected highlight flash)

### 3. Autocomplete not working ("not even recognizing links") — resolved

> **Task:** [TASK-0404](tasks.md#task-0404-implement-autocomplete-monkeypatch-done) — `EditorSuggest.selectSuggestion` interceptor. **Validation:** [`autocomplete.md`](validation/autocomplete.md).

- **Resolution**: Shifted approach from patching `generateMarkdownLink` (which broke native autocomplete) to mutating `value.subpath` on `EditorSuggest.selectSuggestion` before native insertion. See [Session 2, Bugs 2 + 2.1](#2-autocomplete--resolved) for the full fix.
- **Issue**: Native link suggestions (typing `[[`) stopped working completely, and OFM suggestions didn't output GFM slugs.
- **Probable Cause Candidates**:
  1. `app.fileManager.generateMarkdownLink` needs to be monkeypatched to rewrite the subpath.
      - [x] (Attempt 1: Monkeypatched `generateMarkdownLink` at the instance level. Result: Broke native link autocomplete entirely. The suggester stopped functioning)
  2. The native `EditorSuggest` instance handles link suggestions directly, bypassing `generateMarkdownLink`.
      - [x] (Attempt 2: Wrapped its `selectSuggestion` method to intercept `editor.replaceRange`. Result: Failed. Autocomplete is still broken/not functioning as expected)

---

## Session 2 (Post-DevTools Analysis)

### 1. Hover Preview ("links nowhere") — resolved

> **Task:** [TASK-0403](tasks.md#task-0403-update-triggerhover-link-interceptor-done) — `trigger('hover-link')` interceptor. **Validation:** [`hover-preview.md`](validation/hover-preview.md). **Same root cause as** [Session 1, Bug 1](#1-hover-preview-fails-hovering-cant-find--links-nowhere--resolved).

- **Code Analysis**: The `hover-link` interceptor was successfully parsing the link but failing to resolve the target, returning `undefined`. This led to an initial assumption that Virtual Block Injection was incompatible with `HoverPopover`.
- **Resolution**: `buildDocumentIndex` was passed `cache.headings` instead of `cache`, producing an empty index.
  >[!note] Question
  >Why this solves the problem?
- **Probable Cause Candidates**:
  1. `buildDocumentIndex` was passed `cache.headings` instead of `cache`, resulting in an empty index.
      - [x] (Attempting to Fix: Corrected the function call to `buildDocumentIndex(cache)`. Result: Success! The target was resolved and Virtual Block Injection successfully displayed the exact duplicate heading.)

### 2. Autocomplete — resolved

> **Task:** [TASK-0404](tasks.md#task-0404-implement-autocomplete-monkeypatch-done) — `EditorSuggest.selectSuggestion` interceptor. **Validation:** [`autocomplete.md`](validation/autocomplete.md). **Follow-up:** [Bug 2.1](#21-autocomplete-alias-loss--missing-duplicate-suffixes--resolved).

- **Code Analysis**: The DevTools output `['t', 't', 't']` confirmed that native `EditorSuggest` classes are highly obfuscated/minified by Obsidian. Our previous patch targeted them successfully, but the internal `value` object passed to `selectSuggestion(value)` does NOT have a simple `value.type === 'heading'` property as assumed. Furthermore, even when correctly extracting the heading from the internal obfuscated object (e.g. `{subpath: '#Heading'}`), our `editor.replaceRange` monkeypatch did not trigger, revealing that Obsidian uses internal methods (like CodeMirror 6 transactions) to insert the text natively.
- **Resolution**: Mutated the `value` object passed to `selectSuggestion` before delegating to the native insertion logic.
- **Probable Cause Candidates**:
  1. Monkeypatching `editor.replaceRange` is ineffective because Obsidian inserts text using a lower-level API.
      - [x] (Attempting to Fix: Mutated the `value` object passed to `selectSuggestion` before delegating to the native insertion logic. Result: Mostly successful. It natively inserts the GFM slug. However, alias loss and missing duplicate suffixes occurred.)

### 2.1 Autocomplete: Alias Loss & Missing Duplicate Suffixes — resolved

> **Tasks:** [TASK-0404](tasks.md#task-0404-implement-autocomplete-monkeypatch-done) — EditorSuggest interceptor, [TASK-0407](tasks.md#task-0407-fix-editorsuggest-alias--cache-latency-done) — alias + cache. **Validation:** [`autocomplete.md`](validation/autocomplete.md).

- **Code Analysis**:
  1. **Alias Loss**: Natively, when Wikilinks are turned off, Obsidian builds a Markdown link formatted as `[value.heading](value.subpath)`. By mutating both, we lost the original casing and text for the alias.
  2. **Duplicate Suffixes & Header Levels**: The `value` object provided by Obsidian for an autocomplete suggestion contains the `heading` text and the `level`, but no exact line index. Natively, Obsidian itself cannot differentiate identical headings of the same text and level during autocomplete.
- **Probable Cause Candidates**:
  1. Over-mutation of `value.heading` overwrites the display alias.
      - [x] (Attempting to Fix: Stop mutating `value.heading` and strictly mutate `value.subpath`.)
  2. Failing to lookup the `heading` and `level` inside `metadataCache.getFileCache(value.file).headings` caused us to generate a naive base slug without duplicate suffixes.
      - [x] (Attempting to Fix (Iteration 1): Implement `resolveGfmSlug(value, app)` to calculate `finalSlug`. Result: Failed for identical text at the same level.)
  3. `resolveGfmSlug(value, app)` lacks context on WHICH occurrence was selected from the dropdown for identical headings.
      - [x] (Attempting to Fix (Iteration 2): Implement an advanced `resolveGfmSlug(value, app, suggestInstance)` helper to inspect `suggestInstance.chooser.values`. Result: Perfectly resolves the duplicate limitation.)

### 3. Highlighting (Section vs Header) — resolved

> **Tasks:** [TASK-0301](tasks.md#task-0301-implement-srcreveal-targetts-done) — `revealTargetInView`, [TASK-0401](tasks.md#task-0401-update-openlinktext-interceptor-done) — Virtual Block Injection. **Validation:** [`reveal-target.md`](validation/reveal-target.md), [`click-navigation.md`](validation/click-navigation.md).

- **Code Exploration**: The user noted that only the header line receives `.is-flashing`, and expected the entire section to flash. Currently, `revealTargetInView` uses `mode.applyScroll(target.line, { highlight: true })`, which natively only highlights the single line (header).
- **Resolution**: Repurposed Virtual Block Injection for click navigation — inject section into `cache.blocks` and delegate to Obsidian's native block-reference navigation (`#^virtual-id`), which natively flashes the entire block.
- **Probable Cause Candidates**:
  1. `applyScroll` inherently only highlights the target line, not the full section block.
      - [x] (Attempting to Fix: Restored the clean `applyScroll` call and removed the broken polling mechanism to match Obsidian's native behavior.)
      - [x] (New Attempt: Since matching native behavior is not fulfilling the user's expectation of flashing the entire section, we repurposed the "Virtual Block Injection" trick used for hover-preview. By temporarily injecting the section into `cache.blocks` and delegating to Obsidian's native block-reference navigation (`#^virtual-id`), Obsidian natively flashes the entire block. Result: Success!)

### 4. Page Preview (`hover-link`) Not Triggering — resolved

> **Task:** [TASK-0403](tasks.md#task-0403-update-triggerhover-link-interceptor-done) — `trigger('hover-link')` interceptor. **Validation:** [`hover-preview.md`](validation/hover-preview.md). **Same root cause as** [Session 2, Bug 1](#1-hover-preview-links-nowhere--resolved): `buildDocumentIndex(cache.headings)` → empty index.

- **Bug Description**: Hovering over a GFM link does not show the Page Preview, and initially nothing was logged.
- **Code Exploration**: We added `console.log` at the entry point of the `workspace.trigger('hover-link')` monkeypatch. The user's console output showed that the interceptor IS triggering and successfully parsing the slug: `[GFM Heading Links] hover-link slug: red-hat-based-distributions-centos-fedora`. However, it never reaches the `reveal:preview-virtual-block` log and doesn't log any errors.
- **Probable Cause Candidates**:
  1. `workspace.trigger` is not the method Obsidian uses natively for Page Preview when hovering over reading mode/live preview links.
      - [x]
  2. The guard condition `!/[A-Z]/.test(slug)` is rejecting the link before logging anything.
      - [x]
  3. The `require("./document-index")` inside the bundled code is failing, but perhaps it crashes outside our `try/catch`? (Unlikely, it's inside).
      - [x]
  4. The patched `trigger` function signature might be incorrect, or Obsidian might be using `app.workspace.trigger` directly from the prototype rather than the instance.
      - [x]
      - [x]
  5. `file` resolution is failing because `sourcePath` is incorrect or missing.
      - [x] (Console log confirmed file was resolved successfully: `file resolved: dsads.md`)
  6. `cache` or `cache.headings` is null (perhaps the file hasn't fully loaded into the cache).
      - [x] (Console log confirmed cache found with 28 headings)
  7. `index.get(decodedSlug)` is returning undefined (the slug isn't being found in the index).
      - [x] (Console log confirmed `target found: false undefined`)

- **Attempting to Fix (Iteration 1)**: By injecting `console.log` statements throughout the logic, we determined that `index.get(decodedSlug)` was indeed returning `undefined`. Upon further code analysis, we found that we were mistakenly passing `cache.headings` to `buildDocumentIndex` instead of `cache`. Since `buildDocumentIndex(cache)` accesses `cache.headings` internally, our buggy call evaluated to `(cache.headings).headings`, returning `undefined` and yielding an empty document index!
- **Result 1**: We corrected the function call to `const index = buildDocumentIndex(cache);`. This should now correctly generate the target mapping and allow the virtual block injection to proceed.

### 5. Architectural Caveats — resolved

> **Tasks:** [TASK-0405](tasks.md#task-0405-optimize-openlinktext-for-same-file-navigation-done) — same-file optimization, [TASK-0403](tasks.md#task-0403-update-triggerhover-link-interceptor-done) — hover-link virtual block, [TASK-0404](tasks.md#task-0404-implement-autocomplete-monkeypatch-done) + [TASK-0407](tasks.md#task-0407-fix-editorsuggest-alias--cache-latency-done) — alias + cache. **Validation:** [`click-navigation.md`](validation/click-navigation.md), [`hover-preview.md`](validation/hover-preview.md), [`autocomplete.md`](validation/autocomplete.md).

- **Issue**: Potential edge cases with same-file navigation flicker, hover preview duplicate limitations, wikilink alias loss, and autocomplete cache latency.
- **Probable Cause Candidates**:
  + [x] Same-file Flicker: Calling `openLinkText` for a file that is already active might reset the view state, causing a jump-to-top flicker. (Resolved: Bypassed native resolution for same-file links).
  + [x] Hover Duplicate Limitation: `HoverPopover` relies on the immutable cache. Targeting `#Heading` might always show the first duplicate instead of the intended one. (Resolved: Restored Virtual Block Injection).
  + [x] Wikilink Alias Loss: Mutating `value.subpath` in `EditorSuggest` might break the UI alias if "Use Markdown links" is disabled. (Resolved: Stopped mutating `value.heading`).
  + [x] Cache Latency: Rapid typing might cause the `metadataCache` to be stale during `EditorSuggest` generation, yielding wrong duplicate suffixes. (Resolved: Utilized exact dropdown occurrence index).

---

## Session 3 (Validation Matrix Testing — 2026-07-14)

New bugs and behavioral observations discovered while executing the comprehensive validation test suite.

### 1. HTML Anchor Hover Inconsistency — deferred to v2

> **Tasks:** [TASK-0403](tasks.md#task-0403-update-triggerhover-link-interceptor-done) — hover-link interceptor, [TASK-0802](tasks.md#task-0802-toggle-setting-for-html-anchors-deferred--v2) — HTML anchor toggle. **Validation:** [`hover-preview.md`](validation/hover-preview.md). **Deferred to v2 — HTML anchor support requires non-trivial architecture changes across hover, click, and reveal layers.**

- **Issue**: HTML anchors (`<a id="...">`) exhibit inconsistent hover preview behavior depending on their position relative to headings.
- **Test setup**: See [validation.md](validation/validation.md#reveal-target-path-validation) for the `validation-target.md` file used.
- **Observations**:

  | Anchor | Click | Hover | Notes |
  |---|---|---|---|
  | `<a id="html-anchor-section">` (standalone) | ✅ Works (fallback path) | ❓ Not tested | Standalone anchor between headings. |
  | `<a id="html-anchor-header">` (inside heading) → linked via `#html-anchor-header` | ✅ Goes to right header | ❌ No hover link | Anchor ID is inside heading text, so the heading's GFM slug (`a-header-with-an-anchor-a-idhtml-anchor-headera`) also exists. The heading-based resolution takes priority, but the hover path may not inject a virtual block for HTML anchor type targets. |
  | `<a id="html-anchor-header">` (inside heading) → linked via `#a-header-with-an-anchor` (the heading's GFM slug) | ✅ Goes to correct header | ✅ Hover link activates but "cannot find" | The heading resolves, but the hover payload may be looking for a block that doesn't match. |
  | `## Another header with an anchor` (preceded by `<a id="html-anchor-header-1">`) → linked via `#another-header-with-an-anchor` | ✅ Goes to correct header | ✅ Hover link works | This is a normal heading without embedded HTML in its text. Works as expected. |
  | `<a id="html-anchor-header-1">` → linked via `#html-anchor-header-1` | ✅ Goes to correct header | ❌ No hover link | Anchor tag placed BEFORE the heading on its own line. Click works (fallback), hover fails. |

- **Root cause analysis**:
  1. **Standalone HTML anchors** (`<a id="...">` not inside heading text): Resolved by `scanHtmlAnchors()` and stored in the DocumentIndex. Click navigation uses the fallback path (STEP 5 in `openLinkText`) which opens the file and manually scrolls. Hover preview does NOT inject a virtual block for HTML anchor type targets — only for `type: "heading"` targets.
  2. **HTML anchors inside heading text**: The heading text includes the anchor markup (e.g., `## My Heading <a id="x"></a>`). `gfmSlugify()` strips the HTML tags from the slug, producing something like `my-heading-a-idx-a`. The heading still resolves normally via the DocumentIndex, but the embedded anchor creates confusion: two targets exist at the same line (the heading and the HTML anchor), and the hover-link interceptor may pick the wrong one or fail to inject a virtual block for the anchor type.
  3. **Anchor before heading**: `<a id="x"></a>` on a line immediately before a heading. The anchor resolves for clicks but hover fails because the hover interceptor's virtual block injection only handles heading-type targets.

- **Probable Cause Candidates**:
  1. The `hover-link` interceptor in `workspace.trigger` only injects virtual blocks for targets where `target.type === "heading"`. HTML anchors (`type: "html-anchor"`) are silently skipped.
      - [ ] (Potential fix: Extend virtual block injection to HTML anchor targets by constructing a synthetic position from `{line, endLine: line + 1}`.)
  2. When an anchor and a heading share the same line (anchor inside heading text), the DocumentIndex may have two entries for effectively the same position, and the hover path picks the heading entry but the linktext targets the anchor slug.
      - [ ] (Potential fix: During index building, if a heading's position overlaps with an HTML anchor's position, skip the HTML anchor entry — headings take priority.)

### 2. Editor Suggest Preserves Raw HTML in Heading Text — resolved

> **Tasks:** [TASK-0404](tasks.md#task-0404-implement-autocomplete-monkeypatch-done) — EditorSuggest interceptor, [TASK-0407](tasks.md#task-0407-fix-editorsuggest-alias--cache-latency-done) — alias + cache. **Validation:** [`autocomplete.md`](validation/autocomplete.md).

- **Issue**: When a heading contains inline HTML (e.g., `## A header with an anchor <a id="x"></a>`), the autocomplete suggestion outputs the raw HTML verbatim in both the link text and the alias.
- **Observed behavior**: Selecting the heading from the `[[` dropdown produces:

  ```out
  [A header with an anchor <a id="html-anchor-header"></a>](validation-target.md#a-header-with-an-anchor-a-idhtml-anchor-headera)
  ```

- **Expected behavior**: The HTML tags should be stripped from the display text/alias. The link target slug correctly strips HTML (GFM slug: `a-header-with-an-anchor-a-idhtml-anchor-headera`).
- **Root cause**: `value.heading` from Obsidian's `EditorSuggest` contains the raw markdown heading text including any inline HTML. Our `applyEditorSuggestPatches` mutates `value.subpath` (the slug) but does NOT clean `value.heading` (the alias/display text). We intentionally stopped mutating `value.heading` to fix the alias loss bug (Session 2, Bug 2.1), but this means HTML in headings passes through unfiltered.
- **Probable Cause Candidates**:
  1. We need to strip HTML tags from `value.heading` before it's used as the alias, but ONLY strip HTML — preserve the original case and text.
      - [x] (Fix: Applied regex `/<\/?[^>]+(>|$)/g` to `value.heading` and `value.item?.heading` to strip HTML tags, followed by `.trim()` to remove leftover whitespace from spaces around the stripped tags. See [`patch-editor-suggest.ts`](../../src/patch-editor-suggest.ts) lines 311-320. Result: HTML tags stripped, trailing whitespace removed.)

### 3. GFM Collision Suffix Ambiguity (The "Commands" Problem) — resolved

> **Tasks:** [TASK-0103](tasks.md#task-0103-build-document-index-in-srcdocument-indexts-done) — `buildDocumentIndex`, [TASK-0804](tasks.md#task-0804-fix-cross-baseslug-collision-in-builddocumentindex-done) — fix. **Validation:** [`click-navigation.md`](validation/click-navigation.md).

- **Issue**: The GFM collision suffix system created ambiguity when a heading's literal text matched the collision-suffix pattern of another heading. The per-baseSlug counter (`slugCounts`) was blind to cross-baseSlug collisions — the 2nd `## Commands` would get slug `commands-1` which was already claimed by the literal `## Commands-1` heading.
- **Test setup**: In `validation-target.md`:

  ```markdown
  ## Commands-1      ← literal heading text IS "Commands-1"
  ## Commands-1      ← another literal "Commands-1" → slug becomes commands-1-1
  ## Commands        ← first "Commands" → slug: commands
  ## Commands        ← second "Commands" → slug: commands-2 (because commands-1 is taken by the literal)
  ```

- **The problem**: The slug `#commands-1` resolves to the LAST heading that produces this slug in document order — NOT necessarily the first. **Observed behavior** (from `test_vault/validation-target.md`): `#commands-1` scrolls to the last literal `## Commands` heading (the one that appears LAST in the document). In the separate `validation-target-duplicate-behavior.md` test, when the literal `## Commands-1` heading appears AFTER the duplicate `## Commands` headings, `#commands-1` goes to the literal `## Commands-1`. In both cases, it goes to whichever heading produces the slug last in document order. This is the **Map insertion behavior**: the last heading with a given slug overwrites earlier entries because the index uses `Map.set()` which replaces existing keys.
- **Root cause**: The collision algorithm used `slugCounts.get(baseSlug)` per heading text, which had no awareness of slugs claimed by DIFFERENT heading texts. When a base slug from one heading (e.g., `"commands"`) produced a collision suffix that matched another heading's literal base slug (e.g., `"commands-1"` from literal `"Commands-1"`), the `Map.set()` silently overwrote the literal's entry.
- **Fix**: The collision resolution logic was extracted to a single reusable function `allocateUniqueSlug()` in `gfm-slugify.ts`. This function checks a `Set<string>` for collisions rather than using per-baseSlug counters, catching both same-text duplicates AND cross-baseSlug conflicts. Both `buildDocumentIndex` (click navigation) and `resolveGfmSlug` (autocomplete) now call this shared function, ensuring they produce identical slugs (DRY, SRP).

  ```typescript
  // Before (broken — duplicated in two files):
  const count = slugCounts.get(baseSlug) || 0;
  const finalSlug = count === 0 ? baseSlug : `${baseSlug}-${count}`;
  slugCounts.set(baseSlug, count + 1);

  // After (fixed — shared in gfm-slugify.ts):
  const finalSlug = allocateUniqueSlug(baseSlug, usedSlugs);
  ```

- **Verification**: Added 2 test cases to `document-index.test.ts`:
  1. `"handles cross-baseSlug collision (literal matches collision suffix)"` — literal `"Commands-1"` before duplicate `"Commands"` headings.
  2. `"handles cross-baseSlug collision with reversed heading order"` — duplicate `"Commands"` before literal `"Commands-1"` (whoever arrives first gets the slug).

  Both pass. `npm test` now runs 19 tests (was 14). Autocomplete manually verified: `## Commands-1` heading in a file with duplicate `## Commands` now outputs the correct slug (matching what `buildDocumentIndex` produces for click resolution). See [`document-index.test.ts`](../../src/test/document-index.test.ts) lines 280-445 and [`gfm-slugify.ts`](../../src/gfm-slugify.ts) for `allocateUniqueSlug`.

### 4. Passthrough Links Produce No Debug Output — resolved

> **Tasks:** [TASK-0501](tasks.md#task-0501-implement-srcdebugts-done) — debug.ts, [TASK-0105](tasks.md#task-0105-implement-resolvegfmtarget-in-srcresolve-targetts-done) — guard logic. **Validation:** [`passthrough.md`](validation/passthrough.md).

- **Observation**: OFM uppercase links, URL-encoded links, block references, and footnote references produce NO console output even with `DEBUG_ENABLED = true`.
- **Analysis**: This is **correct behavior**. These links are detected by the guard in `resolveGfmTarget()` and returned as `{ type: "passthrough" }` before any debug logging occurs. The passthrough guard runs synchronously and silently.
- **Verification**: Confirmed working as designed. The `debugLog("parse:passthrough", ...)` call exists in the code but is only reached for slugs that pass the guard but are not found in the index — not for guard-rejected slugs.

### 5. HTML Anchor Click Only Works in Reading Mode — deferred to v2

> **Tasks:** [TASK-0803](tasks.md#task-0803-investigate--fix-html-anchor-click-in-sourcelive-preview-deferred--v2) — investigation, [TASK-0401](tasks.md#task-0401-update-openlinktext-interceptor-done) — openLinkText, [TASK-0301](tasks.md#task-0301-implement-srcreveal-targetts-done) — revealTargetInView. **Validation:** [`click-navigation.md`](validation/click-navigation.md), [`reveal-target.md`](validation/reveal-target.md). **Deferred to v2 — HTML anchor support requires non-trivial architecture changes across hover, click, and reveal layers.**

- **Issue**: HTML anchor links (`#html-anchor-section`, `#html-anchor-header`, etc.) only resolve in Reading mode. In Live Preview mode, neither clicking nor <kbd>ctrl+right click</kbd> navigation works. In Source mode, behavior is **click-position-dependent**: clicking the parenthesized URL part of a markdown link works, but clicking the alias part does not.
- **Full observed behavior** (from `test_vault/test-link.md`, `validation-target.md`, `validation-target-duplicate-behavior.md`):

  | Mode | Wikilink click | Markdown link click (alias) | Markdown link click (URL) | Hover |
  |---|---|---|---|---|
  | Reading | ✅ Works | N/A — rendered version only | N/A — rendered version only | ⚠️ Page Preview activates but "unable to find" |
  | Live Preview | ❌ Nothing | ❌ Nothing | ❌ Nothing | ❌ No Page Preview |
  | Source mode | ❌ Nothing | ❌ Nothing | ⚠️ Works (Ctrl+click on `(file.md#anchor)`) | ❌ No Page Preview |

  **Specific anchor scenarios tested:**

  | Anchor type | Slug used | Click result | Hover result |
  |---|---|---|---|
  | `<a id="html-anchor-section">` (standalone) | `#html-anchor-section` | ✅ Reading only | ❌ No hover link |
  | `<a id="html-anchor-header">` inside `## A header with an anchor <a id="...">` | `#html-anchor-header` | ⚠️ Reading only — Obsidian's native renderer strips HTML from heading DOM, so native anchor resolution works. Source/Live Preview fail. | ❌ No hover link |
  | Same heading, via GFM slug | `#a-header-with-an-anchor-a-idhtml-anchor-headera` | ✅ All modes (this is a heading, not anchor) | ✅ Works (heading type) |
  | `<a id="html-anchor-header-1">` before heading | `#html-anchor-header-1` | ✅ Reading: goes to `<a>` tag. Source/LP: fail. | ❌ "Unable to find" |
  | `## Another header with an anchor` (normal heading after anchor) | `#another-header-with-an-anchor` | ✅ All modes | ✅ Works (heading type) |

- **Root cause analysis**: The HTML anchor is NOT a heading — `scanHtmlAnchors()` finds it and stores it as `type: "html-anchor"` in the DocumentIndex. When clicked, the `openLinkText` interceptor resolves the target but falls through to STEP 5 (fallback manual reveal) because `target.type !== "heading"`. The fallback path calls `originalOpenLinkText(file.path)` to open the file, then `revealTargetInView()` to scroll.

  **Why it works in Reading mode:** Obsidian's Reading renderer is DOM-based. Either (a) the native anchor element `<a id="...">` is present in the rendered DOM and the browser handles `#anchor` navigation natively, or (b) the fallback `revealTargetInView` → `applyScroll` path works against the rendered DOM. Either way, the DOM environment is forgiving.

  **Why it fails in Live Preview / Source mode:** The CodeMirror editor does not have DOM elements for HTML anchors. `revealTargetInView` uses `view.setEphemeralState({ line })` which may not trigger `applyScroll` correctly for non-heading lines in editor modes. Additionally, there is **evidence the interceptor itself may not fire consistently** — the click-position-dependent behavior in Source mode (URL part works, alias part doesn't) suggests Obsidian may route clicks on different parts of a markdown link through different code paths, some of which bypass our `openLinkText` interceptor entirely.

  **Why hover fails:** The `trigger('hover-link')` interceptor only injects virtual blocks for `target.type === "heading"`. HTML anchor targets are silently skipped. See [Bug 6](#2-html-anchor-hover-inconsistency).

- **Investigation plan** (targeted debug logging needed — root cause not yet confirmed):

  1. [ ] **Add `debugLog("openLinkText:entry", ...)` at the VERY TOP of the `openLinkText` interceptor** — before any guard or parsing. This will confirm whether the interceptor fires at all for each mode × click-position combination. See [click-navigation validation](validation/click-navigation.md#validation-click-navigation-openlinktext).
  2. [ ] **Add `debugLog("openLinkText:step5-fallback", ...)`** inside STEP 5 (the fallback path for non-heading targets) with `{ targetType, targetLine, viewMode }` to confirm the fallback path is reached.
  3. [ ] **Add `debugLog("reveal:attempt", ...)` at the top of `revealTargetInView`** with `{ line, mode, viewType }` to confirm the reveal function is called and with what parameters.
  4. [ ] **Test each mode × link-format combination** systematically using the [click-navigation validation matrix](validation/click-navigation.md#mode--link-format-matrix).
  5. [ ] **Compare wikilink vs markdown link** behavior within the same mode — does the interceptor fire for both? Is the `linktext` format different when received?

- **Probable Cause Candidates** (ranked by likelihood after initial analysis):

  1. **`revealTargetInView` fails in editor modes** — `view.setEphemeralState({ line })` + `applyScroll` may not work in Source/Live Preview for arbitrary line numbers not associated with headings. This would explain why Reading mode works (DOM-based) but editor modes don't.
      - [ ] (Potential fix: In Source/LP mode, use `editor.setCursor({ line, ch: 0 })` + `editor.scrollIntoView()` instead of `setEphemeralState`.)
  2. **`openLinkText` interceptor doesn't fire for certain click positions** — The Source mode observation (URL part works, alias part doesn't) strongly suggests Obsidian routes clicks on `[alias]` vs `(url)` through different handlers. The `(url)` click may trigger `openLinkText` while the `[alias]` click may trigger something else entirely (e.g., cursor placement, internal link navigation).
      - [ ] (Potential fix: After confirming via debug logging, may need to intercept an additional code path — possibly `MarkdownView.onClick` or a CodeMirror click handler.)
  3. **HTML anchor `endLine` too narrow** — `endLine = line + 1` (single line) provides minimal context. If `applyScroll` needs a block span to target, the single-line range may be insufficient.
      - [ ] (Potential fix: Extend `endLine` to the next heading or block boundary during index building.)

### 6. URL-Encoded Passthrough Behavior Differs by Link Format — resolved

> **Tasks:** [TASK-0105](tasks.md#task-0105-implement-resolvegfmtarget-in-srcresolve-targetts-done) — `resolveGfmTarget` guard logic. **Validation:** [`passthrough.md`](validation/passthrough.md).

- **Issue**: URL-encoded slugs like `#my%20heading` are treated as passthrough, but the behavior differs between wikilink and markdown link formats.
- **Observed behavior** (from `test_vault/test-link.md`):

  | Link format | Behavior |
  |---|---|
  | `[[validation-target#my%20heading]]` (wikilink) | ❌ Passthrough — no debug output, no hover |
  | `[my heading](validation-target.md#my%20heading)` (markdown link) | ⚠️ Hover activates, debug shows: `slug: "my heading"` (decoded!), `fileFound: true` |

- **Root cause**: The `resolveGfmTarget` guard checks for `%[0-9A-Fa-f]{2}` patterns and returns `{ type: "passthrough" }` — this works identically for both link types. However, **Obsidian natively decodes URL-encoded slugs in markdown links** before passing them to `openLinkText`. So by the time our interceptor sees the markdown link, the `%20` has already been decoded to a space, and the slug `"my heading"` has a space in it. The space causes the GFM guard (`/[A-Z]/.test(slug)`) to pass (space is not uppercase), and then `decodeURIComponent` doesn't change it. The slug `"my heading"` is then looked up in the index and... actually there IS a heading `## my heading` in validation-target.md. So the link resolves successfully through the normal GFM path, not passthrough.
- **Key insight**: This isn't a bug — it's Obsidian's native URL decoding that bypasses our passthrough guard for markdown links. Wikilinks preserve the `%20` literally, so the guard catches it. But markdown links have already been decoded, so our guard never sees the `%20`.
- **Status**: Working as designed, but the behavior difference between wikilinks and markdown links is surprising and should be documented. See [design.md](design.md#55-passthrough-links-are-silent).

---

## Session 4 (Code Review — 2026-07-16)

Architectural and code quality issues discovered during a comprehensive source code review. These are tracked as implementation tasks (TASK-1004 through TASK-1009) rather than bugs — they represent technical debt and DRY/SOLID violations, not functional defects. All block the v1.3 release.

### 1. GFM Slug Guard Duplicated (DRY) — resolved

> **Task:** [TASK-1004](tasks.md#task-1004-extract-isgfmslug-shared-guard-function-done). **Objectives:** [OBJ-011](objectives.md#v13-code-quality-objectives--refactoring-from-code-review). **Design:** [§5.6](design.md#56-gfm-slug-guard-duplicated-across-modules--resolved).

- **Resolution**: Extracted `isGfmSlug()` into `gfm-slugify.ts` with full JSDoc. Both `resolve-target.ts` and `patch-link-hover.ts` import it. Also discovered and fixed an inverted-condition bug (guard was passthrough-ing valid GFM slugs). Added 6 unit tests (16 assertions). `npm test` passes 25/25.

### 2. Hover Resolution Fork (DRY + `require()` abuse) — resolved

> **Task:** [TASK-1005](tasks.md#task-1005-unify-hover-link-resolution-with-indexcache-done). **Objectives:** [OBJ-012](objectives.md#v13-code-quality-objectives--refactoring-from-code-review). **Design:** [§5.7](design.md#57-hover-resolution-forked-from-main-pipeline--resolved).

- **Issue**: The `trigger('hover-link')` handler reimplements the entire resolution pipeline inline: GFM guard → file resolution → `require("./document-index")` → `buildDocumentIndex(cache)` → virtual block injection. It bypasses `IndexCache` (no caching), `scanHtmlAnchors()` (HTML anchors never work for hover), and `resolveGfmTarget()` (no shared logic). The `require()` call is a CommonJS dynamic import inside an ES module — fragile and bundler-hostile.
- **Root cause**: The hover handler was developed in parallel with the click handler during Session 2 debugging. The `require()` was a quick fix to get the hover interceptor working. It was never refactored to use the shared pipeline.
- **Fix**: Create a synchronous variant `resolveGfmTargetSync()` that uses only metadata cache (no disk I/O for HTML anchors). The hover handler calls this instead of its inline resolution. Alternatively, pre-resolve on hover intent and cache the result.
- **Risk**: Medium. The synchronous constraint (hover events must mutate the payload before Obsidian processes it) means we can't use `await vault.read()` for HTML anchor scanning. The sync variant will be a subset: GFM guard + file resolution + `buildDocumentIndex(cache)` — no HTML anchors, but the current hover handler doesn't scan HTML anchors either, so this is parity, not regression.
- **Resolution**: Added `resolveGfmTargetSync()` to `resolve-target.ts` — synchronous variant using only metadata cache, same `ResolutionResult` return type. `patch-link-hover.ts` calls this instead of ~80 lines of inline resolution. The `require("./document-index")` call eliminated. `tsc --noEmit` passes with zero errors.

### 3. Virtual Block Injection Duplicated (DRY + Magic Number) — resolved

> **Task:** [TASK-1006](tasks.md#task-1006-extract-shared-virtual-block-injection-utility-done). **Objectives:** [OBJ-013](objectives.md#v13-code-quality-objectives--refactoring-from-code-review). **Design:** [§5.8](design.md#58-virtual-block-injection-duplicated--resolved).

- **Issue**: The pattern "inject temp block → setTimeout(1500ms) → delete from `cache.blocks`" appears twice in `patch-workspace.ts` (click handler and hover handler). The only difference is the virtual block ID prefix (`gfm-click-` vs `gfm-`). The 1500ms cleanup timeout is a magic number repeated in both locations.
- **Fix**: Extract `injectVirtualBlock(cache, slug, position, prefix): () => void` — injects the block and returns a cleanup function. The cleanup timeout becomes a named constant `VIRTUAL_BLOCK_CLEANUP_MS = 1500`.
- **Impact**: Low. Pure refactoring. Both callers already follow the same pattern.
- **Resolution**: Created `src/virtual-block.ts` with `injectVirtualBlock()` + `VIRTUAL_BLOCK_CLEANUP_MS = 1500` constant. Returns cleanup function that clears timeout and removes virtual block. Used by both `patch-link-click.ts` and `patch-link-hover.ts`.

### 4. patch-workspace.ts SRP Violation — resolved

> **Task:** [TASK-1007](tasks.md#task-1007-split-patch-workspacets-by-responsibility-done). **Objectives:** [OBJ-014](objectives.md#v13-code-quality-objectives--refactoring-from-code-review). **Design:** [§5.9](design.md#59-patch-workspacets-violates-single-responsibility--resolved).

- **Issue**: One file monkeypatches two unrelated Obsidian APIs. Each interceptor is ~130 lines of complex logic. Combined, the file is 270+ lines doing two distinct jobs.
- **Fix**: Split into `src/patch-link-click.ts` (exports `applyClickPatch`) and `src/patch-link-hover.ts` (exports `applyHoverPatch`). `main.ts` calls both and stores both teardown functions.
- **Impact**: Low implementation risk. The two interceptors share no mutable state — they're independent closures that happen to live in the same file.
- **Resolution**: `patch-workspace.ts` deleted. Replaced by `patch-link-click.ts` (`applyClickPatch`, async + HTML anchors) and `patch-link-hover.ts` (`applyHoverPatch`, sync, no HTML anchors). Variable `data` → `hoverEventPayload` (TASK-1008 partial). `main.ts` imports both separately.

### 5. Weak Variable Naming — resolved

> **Task:** [TASK-1008](tasks.md#task-1008-rename-weak-variable-names-done). **Objectives:** [OBJ-015](objectives.md#v13-code-quality-objectives--refactoring-from-code-review).

- **Issue**: Multiple variables have names that obscure their purpose:
  + `data` in the hover-link handler — event payload containing `linktext`, `sourcePath`, `hoverParent`, state. Rename to `hoverEventPayload`.
  + `value` in the editor suggest patch — the suggestion object selected from the dropdown. Rename to `suggestionValue`. (Acknowledged in code comments as weak but never fixed.)
  + `link-target.ts` filename — contains type definitions, not link-target logic. Rename to `types.ts`.
- **Fix**: Rename variables and file. Update all imports. Zero logic change.
- **Impact**: Trivial. Search-and-replace refactoring. The `link-target.ts` → `types.ts` rename affects every import in the codebase (9 files).
- **Resolution**: `data` → `hoverEventPayload` (done in TASK-1007). `value` → `suggestionValue`, `mutated` → `didModifySubpath` in `patch-editor-suggest.ts`. `link-target.ts` renamed to `types.ts` — all 5 imports across the codebase updated. `tsc --noEmit` passes with zero errors.

### 6. O(n²) Section Boundary Algorithm — resolved

> **Task:** [TASK-1009](tasks.md#task-1009-stack-based-on-section-boundary-algorithm-done). **Objectives:** [OBJ-016](objectives.md#v13-code-quality-objectives--refactoring-from-code-review). **Design:** [§5.10](design.md#510-on2-section-boundary-algorithm--resolved).

- **Issue**: `buildDocumentIndex` uses a nested loop to compute `endLine`: for each heading `i`, scan forward `j = i+1..n` for the next same-or-higher-level heading. O(n²) worst case.
- **Fix**: Single-pass stack algorithm. Push headings onto a stack. When a heading with level ≤ stack-top's level is encountered, pop the stack and finalize the popped heading's `endLine` as `currentHeading.start.line - 1`. After the loop, remaining stack entries extend to end-of-file.
- **Impact**: For typical files (<100 headings), the O(n²) behavior is negligible. But the stack-based approach is actually simpler code (no inner loop, no `break`), so this is a code clarity improvement as much as a performance one.
- **Verification**: Existing `document-index.test.ts` endLine tests must pass unchanged. Add a test with 50+ nested headings to verify O(n) behavior.
- **Resolution**: Replaced nested loop with 2-pass approach: Pass 1 uses a stack to compute all `endLine`/`endOffset` values in O(n), Pass 2 builds `HeadingAnchorTarget` entries. All 25 existing tests pass unchanged. Code is both faster and simpler (no inner loop, no `break`).

## Session 4: Community Review Linter (2026-07-20)

### 1. `this: void` — methods detached from object — resolved

> **Task:** [TASK-1302](tasks.md#task-1302-fix-this-void-linter-warnings-done). **Phase:** [Phase 13](tasks.md#phase-13-community-review-compliance).

- **Observed Warning**: Obsidian's automated review linter reported `this: void` warnings at `src/patch-link-click.ts:46` and `src/patch-link-hover.ts:64`. The warning: "A method that is not declared with `this: void` may cause unintentional scoping of `this` when separated from its object."
- **Root Cause**: `const originalOpenLinkText = workspace.openLinkText` captures the method reference detached from the `workspace` object. When later called via `.call(workspace, ...)`, the `this` rebinding is explicit but the linter flags the capture itself as a potential `this`-scoping hazard.
- **Fix**: Bind at capture time: `const originalOpenLinkText = workspace.openLinkText.bind(workspace)`. Then replace all `.call(workspace, ...)` invocations with direct calls — the binding makes `.call()` redundant.
- **Files changed**: `src/patch-link-click.ts` (lines 46, 74, 81, 106), `src/patch-link-hover.ts` (lines 64, 83, 124).
- **Resolution**: Both files now use `.bind(workspace)` at method capture and direct invocation. Obsidian linter passes — no `this: void` warnings.

### 2. `console.log` in production builds — resolved

> **Task:** [TASK-1303](tasks.md#task-1303-production-console-hygiene-done).

- **Observed Warning**: `console.log` statements flagged even within a gated debug system (`DEBUG_ENABLED` check). Obsidian's linter does not perform data-flow analysis — it flags any `console.log` regardless of runtime guards.
- **Fix**: Changed `console.log` → `console.debug` in `src/debug.ts`. `console.debug` is semantically correct (debug-level messages) and is suppressed by default in Chrome DevTools at the default "Info" log level.
- **Resolution**: `grep -r 'console\\.log' src/` returns zero results. Linter passes.

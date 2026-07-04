# failed logic

## when planning

1. Only read lines 1-200

    ```md
    Read [](file:///home/lucas_galdino/my_pc/repositories/obsidian-repos/obsidian-gfm-headers/starting-point.md#1-1), lines 1 to 200
    ```

2. Didn't link the vault `/home/lucas_galdino/my_pc/projects/test_vault`, nor used #askQuestions tool to make sure where to input it. This is also kinda my fault.

    ```bash
    # Symlink into your dev vault's plugins folder:
    ln -s /home/lucas_galdino/my_pc/repositories/obsidian-repos/obsidian-gfm-headers \
      /path/to/dev-vault/.obsidian/plugins/gfm-heading-links
    ```

3. No `README.md` file.

4. current version of the html is done:

   ```html redenred version
   <a class="internal-link" data-href="#linux-commands-list" href="#linux-commands-list" target="_blank" rel="noopener nofollow">Linux commands list</a>
   ```

   ```html source mode
   <div class="cm-active HyperMD-list-line HyperMD-list-line-1 cm-line" dir="ltr" style="text-indent: -17px; padding-inline-start: 17px;"><div class="cm-fold-indicator" contenteditable="false"><div class="collapse-indicator collapse-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon right-triangle"><path d="M3 8L12 17L21 8"></path></svg></div></div><img class="cm-widgetBuffer" aria-hidden="true"><span class="cm-formatting cm-formatting-list cm-formatting-list-ul cm-list-1">- </span><span class="cm-formatting cm-formatting-link cm-link cm-list-1" spellcheck="false">[</span><span class="cm-link cm-list-1">Linux commands list</span><span class="cm-formatting cm-formatting-link cm-link cm-list-1" spellcheck="false">]</span><span class="cm-formatting cm-formatting-link-string cm-list-1 cm-string cm-url" spellcheck="false">(</span><span class="cm-list-1 cm-string cm-url" spellcheck="false">&lt;#linux-commands-list&gt;</span><span class="cm-formatting cm-formatting-link-string cm-list-1 cm-string cm-url" spellcheck="false">)</span></div>
   ```

   ```html wysiwyg
   <div class="cm-active HyperMD-list-line HyperMD-list-line-1 cm-line" dir="ltr" style="text-indent: -29px; padding-inline-start: 29px;"><div class="cm-fold-indicator" contenteditable="false"><div class="collapse-indicator collapse-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon right-triangle"><path d="M3 8L12 17L21 8"></path></svg></div></div><img class="cm-widgetBuffer" aria-hidden="true"><span class="cm-formatting cm-formatting-list cm-formatting-list-ul cm-list-1"><span class="list-bullet">-</span> </span><img class="cm-widgetBuffer" aria-hidden="true"><span contenteditable="false"></span><img class="cm-widgetBuffer" aria-hidden="true"><span class="cm-link cm-list-1"><span class="cm-underline" tabindex="-1" draggable="true">Linux commands list</span></span><img class="cm-widgetBuffer" aria-hidden="true"><span contenteditable="false"></span><img class="cm-widgetBuffer" aria-hidden="true"><img class="cm-widgetBuffer" aria-hidden="true"><span contenteditable="false"></span><img class="cm-widgetBuffer" aria-hidden="true"><img class="cm-widgetBuffer" aria-hidden="true"><span contenteditable="false"></span><img class="cm-widgetBuffer" aria-hidden="true"><img class="cm-widgetBuffer" aria-hidden="true"><span contenteditable="false"></span><img class="cm-widgetBuffer" aria-hidden="true"></div>
   ```

---

## iter 2

- Reading view: click handler fires, rewrites data-href, but Obsidian has already consumed the click before the rewrite takes effect. Second click works because `data-href` was already fixed. Classic race condition.

  >[!important]
  >1. Did not understand this behavior and why it happens. Please link me to the documentation.
  >2. So, how can this be solved? I guess there must be a way to overwrite default behavior.
- Live Preview: not working at all — likely different DOM structure or event handling
  >[!important]
  >what do you need to investigate this? All reference is given inside. I;ve added the docs for obsidian in the current workspace.
- Ctrl+hover: can't work with click-only approach — hover resolution bypasses click events entirely
  >[!important]
  >this does not seems true. Other extensions make it work.

>Problem 1: Reading view needs 2 clicks
>The data-href rewrite happens in the click event handler. But Obsidian's link resolver also processes that same click event. By the time your handler rewrites data-href, Obsidian has already read the old value and attempted resolution (which fails). Second click works because data-href is now pre-corrected.
>
>Fix: Use registerMarkdownPostProcessor for Reading view. This rewrites data-href at render time — before any user interaction. Both click and Ctrl+hover will then see the corrected value. Zero timing issues.

This was already discussed before, and should've been implemented.

>Problem 2: Live Preview not working at all
>Live Preview uses CodeMirror 6's DOM overlay. The <a> elements may have different event routing, and Obsidian's Live Preview click handler likely consumes the event before (or differently from) my click-phase handler.
>
>Fix: Register the DOM event on mousedown with { capture: true }. mousedown fires before click. In capture phase, my handler fires before any bubbling handlers. The rewrite happens before Obsidian's click-phase link resolver ever sees the old value. Single click.

Also discussed, though not solved. You shall search inside the `typescript API` folder for keywords and important related information about it.

> Problem 3: Ctrl+hover in Live Preview
> This is the hardest problem. Hover preview uses Obsidian's internal link resolver which doesn't go through any DOM event. For Reading view, registerMarkdownPostProcessor fixes it. For Live Preview, it would require a CodeMirror 6 extension via registerEditorExtension — significantly more complex.
>
> Proposed: Solve Reading view hover now. Document Live Preview hover as a known limitation, then tackle via CM6 extension as a follow-up.

Yeash, but not extensively searched. For sure there are solutions aiming at solving this problem. I've already saw extensions altering the behavior of hover elements. The hover element currently works when using normal

> Problem 4: Not even talked about, but source mode does not go on click as well. I guess the whole think.

Better read the plugins documentation, as in the [editor extensions](/home/lucas_galdino/.agents/skills/obsidian/obsidian-plugins/references/Plugins/Editor/Editor extensions.md) and [editor plugins folder overall](/home/lucas_galdino/.agents/skills/obsidian/obsidian-plugins/references/Plugins/Editor). Those files Use wikilinks to refer to other files, that should give you a hint on what to look for.

Remember, you can activate other #search Subagents

---

## Iter 3

### Root Cause: No `<a>` Tags in Source Mode or Live Preview

This is the fundamental revelation. You provided the actual DOM for each mode:

| View mode | Link element | Has `data-href`? | Interceptable by DOM handler? |
|-----------|-------------|------------------|-------------------------------|
| **Reading view** | `<a class="internal-link" data-href="#linux-commands-list">` | ✅ Yes | ✅ Yes |
| **Source mode** | `<span class="cm-string cm-url">` + `<span class="cm-link">` | ❌ No | ❌ No — `target.closest("a")` returns `null` |
| **Live Preview** | `<span class="cm-link"><span class="cm-underline">` | ❌ No | ❌ No — no `<a>` tag anywhere |

The previous approach searched for `target.closest("a")` — which works in Reading view but finds **nothing** in Source mode or Live Preview. Those modes render links entirely as `<span>` elements via CodeMirror 6. The link target (`#linux-commands-list`) is stored in the CM6 **syntax tree**, not in any DOM attribute.

This is why Source mode and Live Preview never worked — there's literally nothing for the click handler to intercept.

### What Needs to Happen Per Mode

#### Reading View

`registerMarkdownPostProcessor` should work here — `<a>` tags with `data-href` exist in the rendered HTML. The post-processor rewrites them before any interaction. Both single-click and Ctrl+hover should work.

#### Source Mode & Live Preview — Needs CM6 ViewPlugin

The Obsidian docs are explicit about this (`Plugins/Editor/Editor extensions.md`):

> "If you want to change how the document looks and feels in **Live Preview**, you need to build an editor extension."

The approach for Source/Live Preview:

1. **Register a CM6 `ViewPlugin`** via `registerEditorExtension()` — this gives access to the `EditorView` (available via `editorEditorField` state field)
2. **Intercept `mousedown`** on the editor's DOM element through the ViewPlugin's constructor
3. **Identify link clicks** by checking if the click target is a `.cm-underline` or `.cm-link` span
4. **Extract the link target** from CM6's syntax tree (resolve the syntax node at the cursor position, find the `Link` node, extract its URL)
5. **Resolve GFM slug** against actual headings via `metadataCache.getFileCache()`
6. **Prevent default** (`evt.preventDefault()` + `evt.stopImmediatePropagation()`) to stop Obsidian's failed resolution
7. **Navigate programmatically** via `this.app.workspace.openLinkText(correctedLink, sourcePath)`

#### Ctrl+hover — Different Per Mode

| Mode | Hover fix |
|------|-----------|
| Reading view | Fixed by `registerMarkdownPostProcessor` — `data-href` pre-corrected |
| Source mode | Needs CM6 `hoverTooltip` from `@codemirror/view` |
| Live Preview | Needs CM6 `hoverTooltip` — more complex because WYSIWYG rendering hides the URL |

The CM6 hover solution would use `hoverTooltip()` from `@codemirror/view` to show a custom tooltip when hovering over `.cm-link` spans whose target is a GFM slug.

---

### Proposed Implementation Order

1. **Debug Reading view post-processor** — verify it's actually running (add temporary `console.log`)
2. **Add CM6 ViewPlugin** for Source/Live Preview click handling using `registerEditorExtension()` + `editorEditorField` + `openLinkText()`
3. **Add CM6 hover tooltip** for Source/Live Preview hover (follow-up)

### Reading View — Why the Post-Processor Might Not Be Working

The `registerMarkdownPostProcessor` has a **sort order** concern. Obsidian and Better Markdown Links also register post-processors. If theirs run AFTER mine, they could overwrite my `data-href` rewrite. The `sortOrder` parameter controls this — I didn't set it, so it defaults to a middle value.

**Better approach for Reading view:** Instead of relying on the post-processor pipeline, use a **`MutationObserver`** on the preview DOM — this fires AFTER all rendering is done, regardless of plugin ordering:

```
DOM rendered → all post-processors finish → MutationObserver fires → rewrite data-href
```

## Source Mode & Live Preview — No `<a>` Tags At All

The DOM you provided proves this conclusively. Source mode and Live Preview render links as `<span>` elements inside CodeMirror 6. The solution requires a **CM6 `ViewPlugin`** registered via `registerEditorExtension()`:

1. Intercept `mousedown` on the editor DOM in capture phase
2. Detect clicks on `.cm-link` / `.cm-underline` spans
3. Extract the link target from the CM6 syntax tree at the click position
4. Resolve GFM slug against actual headings
5. Call `evt.preventDefault()` + `evt.stopImmediatePropagation()`
6. Navigate via `this.app.workspace.openLinkText(correctedTarget, sourcePath)`

---

## Updated Architecture

| View mode | Click fix | Hover fix |
|-----------|-----------|-----------|
| **Reading view** | `MutationObserver` on preview (robust against sort order) | Same — `data-href` pre-corrected |
| **Source mode** | CM6 `ViewPlugin` with `mousedown` capture + `openLinkText()` | CM6 `hoverTooltip` (follow-up) |
| **Live Preview** | CM6 `ViewPlugin` with `mousedown` capture + `openLinkText()` | CM6 `hoverTooltip` (follow-up) |

---

I'll implement this now — Reading view MutationObserver first, then the CM6 ViewPlugin for Source/Live Preview. Sound right?

# GFM Heading Links Architecture (Complete System)

These updated diagrams map out **all** interactions across the plugin's lifecycle, including editor auto-completion, page preview hovers, cache invalidations, and link clicks.

## 1. System Class & Module Diagram

This diagram outlines the complete structure of the plugin, including the standalone modules, caching systems, and data models. It specifically details how the `onload` method interacts with the external patching modules.

```mermaid
classDiagram
    class GfmHeadingLinksPluginImpl {
        -cleanupFunctions: Function[]
        +indexCache: IndexCache
        +onload()
        +onunload()
    }
    
    class patchWorkspace {
        <<module>>
        +applyWorkspacePatches(plugin)
    }
    
    class patchEditorSuggest {
        <<module>>
        +applyEditorSuggestPatches(plugin)
    }

    class IndexCache {
        -cache: Map~string, Promise~DocumentIndex~~
        +get(file: TFile) Promise~DocumentIndex~
        -computeIndex(file: TFile) Promise~DocumentIndex~
        +invalidate(file: TFile)
        +invalidateRename(oldPath, newPath)
    }

    class DocumentIndexBuilder {
        <<module>>
        +buildDocumentIndex(cache) DocumentIndex
        +scanHtmlAnchors(fileContent) HtmlAnchorTarget[]
    }

    class gfmSlugify {
        <<module>>
        +gfmSlugify(text: string) string
    }
    
    class ResolveTarget {
        <<module>>
        +resolveGfmTarget(...) Promise~ResolutionResult~
    }
    
    class RevealTarget {
        <<module>>
        +revealTargetInView(view, target)
    }

    class AnchorTarget {
        <<interface>>
        +type: string
        +slug: string
        +line: number
        +endLine: number
    }
    
    class HeadingAnchorTarget {
        <<interface>>
        +type: "heading"
        +heading: string
        +level: number
        +position: any
    }
    
    class HtmlAnchorTarget {
        <<interface>>
        +type: "html-anchor"
    }
    
    class ResolutionResult {
        <<interface>>
        +type: "success" | "passthrough" | "file-not-found"
        +target: AnchorTarget
        +file: TFile
    }

    %% Inheritance
    AnchorTarget <|-- HeadingAnchorTarget
    AnchorTarget <|-- HtmlAnchorTarget
    
    %% Relationships mapping onload interactions
    GfmHeadingLinksPluginImpl *-- IndexCache : Instantiates in onload
    GfmHeadingLinksPluginImpl ..> patchWorkspace : Calls applyWorkspacePatches in onload
    GfmHeadingLinksPluginImpl ..> patchEditorSuggest : Calls applyEditorSuggestPatches in onload
    
    %% Internal Module usages
    IndexCache --> DocumentIndexBuilder : Uses to build index
    IndexCache --> AnchorTarget : Map values
    DocumentIndexBuilder --> gfmSlugify : Uses for headings
    
    patchWorkspace --> ResolveTarget : Uses on click/hover
    patchWorkspace --> RevealTarget : Uses on fallback reveal
    patchEditorSuggest --> gfmSlugify : Uses to rewrite text
    
    %% Connecting the data structures/interfaces to the resolvers
    ResolveTarget ..> ResolutionResult : Returns
    ResolutionResult *-- AnchorTarget : Contains target data
```

## 2. Interaction Flowcharts

To make the distinct systems easier to read, the global flowchart has been separated into four independent interaction domains.

### 2.1 Background Event Listeners (Cache Invalidation)

```mermaid
flowchart TD
    M["metadataCache: 'changed'"] --> Inv["IndexCache.invalidate"]
    R["vault: 'rename'"] --> InvR["IndexCache.invalidateRename"]
    D["vault: 'delete'"] --> Inv
```

### 2.2 Editor Auto-Suggest (Typing Links)

```mermaid
flowchart TD
    AS["User types [[# "] --> ES["Obsidian shows Native Suggestions"]
    ES --> SEL["User selects a Heading"]
    SEL --> PES["patchEditorSuggest intercepts selection"]
    PES --> SLUG["gfmSlugify converts native heading"]
    SLUG --> INS["Injects [[#gfm-slug]] instead of native"]
```

### 2.3 Page Preview (Hovering Links)

```mermaid
flowchart TD
    HOV["User hovers a link"] --> TRIG["patchWorkspace intercepts trigger"]
    TRIG --> TH{"Is 'hover-link' & contains #?"}
    TH -- Yes --> TRES["Resolve target synchronously"]
    TRES --> TSLUG{"Is it a GFM slug?"}
    TSLUG -- Yes --> TINJ["Inject Virtual Block ID into cache"]
    TINJ --> TMOD["Mutate event payload to #^virtualId"]
    TMOD --> TNAT["Call originalTrigger"]
    
    TH -- No --> TNAT2["Call originalTrigger"]
    TSLUG -- No --> TNAT2
```

### 2.4 Link Click Navigation

```mermaid
flowchart TD
    LC["User clicks a link"] --> LCOPEN["patchWorkspace intercepts openLinkText"]
    LCOPEN --> LRES["resolveGfmTarget"]
    LRES --> LCACHE["IndexCache.get"]
    LCACHE --> LFOUND{"Target Found?"}
    
    LFOUND -- Heading --> LINJ["Inject Virtual Block ID into cache"]
    LINJ --> LNAT["Call originalOpenLinkText with #^virtualId"]
    LNAT --> SCROLL["Obsidian Smooth Scrolls seamlessly"]
    SCROLL --> DEL1["Remove Virtual Block after 1.5s"]
    
    LFOUND -- HTML Anchor --> LREV["revealTargetInView"]
    LREV --> DEL2(["End"])
    
    LFOUND -- No / Passthrough --> LNAT2["Call originalOpenLinkText"]
```

## 3. Full Lifecycle Sequence Diagram

This sequence diagram illustrates the temporal lifecycle of the plugin, from writing a link to reading it, rendering it, and updating the cache when it changes.

```mermaid
sequenceDiagram
    actor User
    participant Editor as Editor Suggest Patch
    participant Patch as Workspace Patch
    participant Resolver as IndexCache / Resolver
    participant Obsidian as Obsidian Native APIs

    %% 1. Writing the Link
    Note over User, Obsidian: 1. Link Creation Phase
    User->>Editor: Types [[# My Heading
    Editor->>Editor: Intercepts selection
    Editor->>Editor: gfmSlugify("My Heading") -> "my-heading"
    Editor-->>User: Editor inserts [[#my-heading]]

    %% 2. Hovering the Link
    Note over User, Obsidian: 2. Link Preview Phase
    User->>Patch: Hovers over [[#my-heading]]
    Patch->>Resolver: Resolve "my-heading" synchronously
    Resolver-->>Patch: Heading metadata
    Patch->>Obsidian: Inject temporary block ID for preview
    Patch->>Patch: Mutate payload linktext to point to virtual block
    Patch->>Obsidian: Run native Page Preview trigger
    Obsidian-->>User: Shows Page Preview modal at correct line
    Patch->>Obsidian: Cleanup virtual block (1.5s delay)

    %% 3. Clicking the Link
    Note over User, Obsidian: 3. Link Navigation Phase
    User->>Patch: Clicks [[#my-heading]]
    Patch->>Resolver: resolveGfmTarget()
    
    alt Cache Miss
        Resolver->>Obsidian: Request CachedMetadata
        Obsidian-->>Resolver: File Metadata
        Resolver->>Resolver: buildDocumentIndex()
    end
    
    Resolver-->>Patch: ResolutionResult (HeadingTarget)
    Patch->>Obsidian: Inject temporary block ID (cache.blocks)
    Patch->>Obsidian: Execute original openLinkText with virtual block
    Obsidian-->>User: Editor smoothly scrolls to the heading natively
    Patch->>Obsidian: Cleanup virtual block (1.5s delay)

    %% 4. Invalidating the cache
    Note over User, Obsidian: 4. File Edit Phase
    User->>Obsidian: Edits the target file contents
    Obsidian->>Resolver: Fires metadataCache 'changed' event
    Resolver->>Resolver: Invalidate file in IndexCache
```

import { type Plugin, TFile } from "obsidian";

/**
 * Slugify a heading string following GFM (GitHub Flavored Markdown) rules.
 * Preserves underscores (GFM keeps them), strips other punctuation,
 * lowercases, replaces whitespace with hyphens, collapses consecutive hyphens.
 */
export function gfmSlugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s\-_]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Given a note path and a GFM-style slug, resolve it to the actual heading
 * text by looking up the target file's metadata cache. Returns null if no
 * matching heading is found.
 */
export function resolveGfmSlug(
  plugin: Plugin,
  notePath: string,
  slug: string,
  sourcePath: string,
): string | null {
  let decodedSlug: string;
  try {
    decodedSlug = decodeURIComponent(slug);
  } catch {
    decodedSlug = slug;
  }

  let file: TFile | null = null;
  if (notePath === "") {
    const abstractFile = plugin.app.vault.getAbstractFileByPath(sourcePath);
    if (abstractFile instanceof TFile) {
      file = abstractFile;
    }
  } else {
    file = plugin.app.metadataCache.getFirstLinkpathDest(notePath, sourcePath);
  }
  if (!file) return null;

  const cache = plugin.app.metadataCache.getFileCache(file);
  const headings = cache?.headings;
  if (!headings || headings.length === 0) return null;

  // GFM appends -1, -2, etc. to duplicate headings. Count occurrences
  // to generate the correct final slug for each heading in document order.
  const slugCounts = new Map<string, number>();

  for (const h of headings) {
    const slugified = gfmSlugify(h.heading);
    const count = slugCounts.get(slugified) ?? 0;

    // First occurrence → no suffix. Subsequent → -1, -2, ...
    const finalSlug = count === 0 ? slugified : `${slugified}-${count}`;

    if (finalSlug === decodedSlug) {
      return h.heading;
    }

    slugCounts.set(slugified, count + 1);
  }

  return null;
}

export type CrawlPage = {
  markdown?: string;
  metadata?: {
    url?: string;
    title?: string;
    description?: string;
    sourceURL?: string;
  };
};

export type CrawlRawData = {
  pages?: CrawlPage[];
};

const DEFAULT_MAX_CHARS = 40_000;
const DEFAULT_MAX_PAGES = 10;

export function isCrawlThin(
  raw: CrawlRawData | null | undefined,
  minPages = 2,
): boolean {
  const pages = raw?.pages ?? [];
  if (pages.length < minPages) return true;
  const withText = pages.filter((p) => (p.markdown?.trim().length ?? 0) > 80);
  return withText.length < minPages;
}

/** Format crawl pages for Gemini prompt; truncates by char budget. */
export function formatCrawlForPrompt(
  raw: CrawlRawData | null | undefined,
  options?: { maxChars?: number; maxPages?: number },
): string {
  const maxChars = options?.maxChars ?? DEFAULT_MAX_CHARS;
  const maxPages = options?.maxPages ?? DEFAULT_MAX_PAGES;
  const pages = (raw?.pages ?? []).slice(0, maxPages);

  if (!pages.length) {
    return "";
  }

  const chunks: string[] = [];
  let used = 0;

  for (const page of pages) {
    const url =
      page.metadata?.url ??
      page.metadata?.sourceURL ??
      page.metadata?.title ??
      "unknown";
    const title = page.metadata?.title ? ` (${page.metadata.title})` : "";
    const body = (page.markdown ?? "").trim();
    if (!body) continue;

    const header = `\n--- Page: ${url}${title} ---\n`;
    const remaining = maxChars - used - header.length;
    if (remaining <= 0) break;

    const truncSuffix = "\n[truncated]";
    const slice = body.length > remaining
      ? `${body.slice(0, Math.max(0, remaining - truncSuffix.length))}${truncSuffix}`
      : body;
    chunks.push(`${header}${slice}`);
    used += header.length + slice.length;
    if (used >= maxChars) break;
  }

  return chunks.join("\n");
}

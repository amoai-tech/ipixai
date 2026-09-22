import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflowSource = readFileSync("src/mastra/workflows/brand-intelligence.ts", "utf8");
const configSource = readFileSync("supabase/config.toml", "utf8");

describe("Brand crawl service authentication contract", () => {
  it("sends the backend credential as apikey, not as a bearer user session", () => {
    const start = workflowSource.indexOf('const startCrawl = createStep({');
    const end = workflowSource.indexOf('const waitForCrawl = createStep({');
    const startCrawlSource = workflowSource.slice(start, end);

    expect(startCrawlSource).toContain('apikey: key');
    expect(startCrawlSource).not.toContain('Authorization: `Bearer ${key}`');
  });

  it("disables platform JWT verification for the service-authenticated function", () => {
    expect(configSource).toMatch(
      /\[functions\.start-brand-crawl\][\s\S]*?verify_jwt\s*=\s*false/,
    );
  });
});

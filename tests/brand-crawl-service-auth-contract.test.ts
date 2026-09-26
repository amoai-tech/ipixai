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

  it("uses one shared backend key for every Edge call, never as a Bearer token", () => {
    expect(workflowSource).toContain("getBackendSecretKey()");
    expect(workflowSource).not.toContain("process.env.SUPABASE_SERVICE_ROLE_KEY");
    expect(workflowSource).not.toMatch(/Authorization: `Bearer \$\{key\}`/);
    const start = workflowSource.indexOf('const extractProfile = createStep({');
    const end = workflowSource.indexOf('const saveDraftAndWait = createStep({');
    expect(workflowSource.slice(start, end)).toContain("apikey: key");
  });

  it.each([
    ["start-brand-crawl", /\[functions\.start-brand-crawl\][\s\S]*?verify_jwt\s*=\s*false/],
    ["brand-intelligence", /\[functions\.brand-intelligence\][\s\S]*?verify_jwt\s*=\s*false/],
    ["firecrawl-webhook", /\[functions\.firecrawl-webhook\][\s\S]*?verify_jwt\s*=\s*false/],
  ])("disables platform JWT verification for %s (the handler authenticates)", (_fn, pattern) => {
    expect(configSource).toMatch(pattern);
  });
});

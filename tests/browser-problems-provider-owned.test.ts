import { describe, expect, it } from "vitest";

import { isProviderOwnedResource } from "../e2e/support/browser-problems";

/**
 * IPI-1329 · MASTRA-INPROC-001 certification: Vercel serves
 * `/_vercel/insights/script.js` only on deployments it builds itself, so the
 * exact-SHA `--prebuilt` Preview logs a 404 console error for a resource the
 * platform does not serve. That exact provider-owned path is filtered; every
 * application path must still be reported.
 */
describe("isProviderOwnedResource", () => {
  it("recognises the Vercel insights and speed-insights resources", () => {
    expect(
      isProviderOwnedResource("https://ipixai-8g76naer5-amoco.vercel.app/_vercel/insights/script.js"),
    ).toBe(true);
    expect(
      isProviderOwnedResource("https://ipixai-8g76naer5-amoco.vercel.app/_vercel/insights/view"),
    ).toBe(true);
    expect(isProviderOwnedResource("https://www.ipix.co/_vercel/speed-insights/script.js")).toBe(true);
  });

  it("still reports application resources, including application 404s", () => {
    expect(isProviderOwnedResource("https://www.ipix.co/api/planner/threads")).toBe(false);
    expect(isProviderOwnedResource("https://www.ipix.co/_next/static/chunks/app.js")).toBe(false);
    expect(isProviderOwnedResource("https://www.ipix.co/_vercel/insights")).toBe(false);
    expect(isProviderOwnedResource(undefined)).toBe(false);
    expect(isProviderOwnedResource("")).toBe(false);
  });
});

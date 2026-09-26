import { describe, expect, it } from "vitest";

import {
  isProviderOwnedMissingResource,
  isProviderOwnedResourcePath,
} from "../e2e/support/browser-problems";

/**
 * IPI-1329 · MASTRA-INPROC-001 certification: Vercel serves
 * `/_vercel/insights/script.js` only on deployments it builds itself, so the
 * exact-SHA `--prebuilt` Preview logs a 404 console error for a resource the
 * platform does not serve.
 *
 * Only that exact condition is filtered: Chromium's own failed-subresource 404
 * message for a provider-owned root path. Every application path and every
 * other console error raised by that script must still be reported.
 *
 * The measured message (real Chromium against the prebuilt Preview on
 * 2026-09-26) is `Failed to load resource: the server responded with a status
 * of 404 ()`; the trailing parentheses carry the server's status text and are
 * empty for a bare 404.
 */
const MEASURED_NOT_FOUND =
  "Failed to load resource: the server responded with a status of 404 ()";

describe("isProviderOwnedResourcePath", () => {
  it("recognises the one Vercel resource this app actually loads", () => {
    expect(
      isProviderOwnedResourcePath(
        "https://ipixai-8g76naer5-amoco.vercel.app/_vercel/insights/script.js",
      ),
    ).toBe(true);
    expect(
      isProviderOwnedResourcePath(
        "https://ipixai-8g76naer5-amoco.vercel.app/_vercel/insights/view",
      ),
    ).toBe(true);
  });

  it("only filters paths this app mounts, so an unmounted provider path still reports", () => {
    // `@vercel/speed-insights` is not installed or mounted (only
    // `@vercel/analytics` is), so its path is deliberately absent from the
    // allowlist. Adopting that package later must fail loudly here and add its
    // path deliberately, instead of silently filtering failures nobody wired.
    expect(
      isProviderOwnedResourcePath("https://www.ipix.co/_vercel/speed-insights/script.js"),
    ).toBe(false);
  });

  it("still reports application resources, including application 404s", () => {
    expect(isProviderOwnedResourcePath("https://www.ipix.co/api/planner/threads")).toBe(false);
    expect(isProviderOwnedResourcePath("https://www.ipix.co/_next/static/chunks/app.js")).toBe(false);
    expect(isProviderOwnedResourcePath("https://www.ipix.co/_vercel/insights")).toBe(false);
    expect(isProviderOwnedResourcePath(undefined)).toBe(false);
    expect(isProviderOwnedResourcePath("")).toBe(false);
  });

  it("matches on the parsed pathname, not on text anywhere in the URL", () => {
    // An application route that merely contains the provider path as a segment.
    expect(
      isProviderOwnedResourcePath("https://www.ipix.co/app/_vercel/insights/script.js"),
    ).toBe(false);
    // An application route that carries the provider path as a query value.
    expect(
      isProviderOwnedResourcePath(
        "https://www.ipix.co/api/proxy?resource=/_vercel/insights/script.js",
      ),
    ).toBe(false);
    // An application route that carries the provider path in the fragment.
    expect(
      isProviderOwnedResourcePath("https://www.ipix.co/app#/_vercel/insights/script.js"),
    ).toBe(false);
    // Not a parseable URL.
    expect(isProviderOwnedResourcePath("/_vercel/insights/script.js")).toBe(false);
  });
});

describe("isProviderOwnedMissingResource", () => {
  it("filters Chromium's failed-resource 404 for a provider-owned path", () => {
    expect(
      isProviderOwnedMissingResource(
        "https://ipixai-8g76naer5-amoco.vercel.app/_vercel/insights/script.js",
        MEASURED_NOT_FOUND,
      ),
    ).toBe(true);
  });

  it("accepts the message without Chromium's trailing status text", () => {
    // Chromium appends the server's status text in parentheses, empty for a
    // bare 404. The match must not depend on that suffix being present.
    expect(
      isProviderOwnedMissingResource(
        "https://ipixai-8g76naer5-amoco.vercel.app/_vercel/insights/script.js",
        "Failed to load resource: the server responded with a status of 404",
      ),
    ).toBe(true);
  });

  it("does not hide other console errors raised by the same script", () => {
    const url = "https://ipixai-8g76naer5-amoco.vercel.app/_vercel/insights/script.js";
    // A CSP violation, a runtime error, or an explicit console.error.
    expect(isProviderOwnedMissingResource(url, "Refused to execute inline script")).toBe(false);
    expect(isProviderOwnedMissingResource(url, "TypeError: x is not a function")).toBe(false);
    expect(isProviderOwnedMissingResource(url, "analytics transport failed")).toBe(false);
    // A different failure status for the same provider-owned path is not the
    // measured condition and stays visible.
    expect(
      isProviderOwnedMissingResource(
        url,
        "Failed to load resource: the server responded with a status of 500 ()",
      ),
    ).toBe(false);
  });

  it("does not filter an application 404", () => {
    expect(
      isProviderOwnedMissingResource("https://www.ipix.co/api/planner/threads", MEASURED_NOT_FOUND),
    ).toBe(false);
    expect(isProviderOwnedMissingResource(undefined, MEASURED_NOT_FOUND)).toBe(false);
  });
});

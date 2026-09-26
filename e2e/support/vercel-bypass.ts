import type { BrowserContext, Page, Route } from "@playwright/test";

/**
 * IPI-1344 · E2E-PREVIEW-BYPASS-001 — Vercel Deployment Protection sits in front
 * of every Preview, so an unauthenticated `/login` is served as Vercel's SSO
 * screen and the real sign-in can never run. The project's existing
 * `VERCEL_AUTOMATION_BYPASS_SECRET` ("Protection Bypass for Automation",
 * https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation)
 * clears it.
 *
 * Two documented Vercel behaviours shape this module:
 *
 * 1. The bypass header is a bearer secret. Playwright's context-wide
 *    `extraHTTPHeaders` would attach it to *every* request the browser makes —
 *    measured against the installed Playwright: cross-origin `fetch`, `<img>`
 *    and `<script>` all received it — leaking the secret to Supabase and
 *    Cloudinary and forcing a CORS preflight those services need not allow.
 *    So the header is applied by a route that rewrites only requests to the
 *    deployment's own origin.
 * 2. `x-vercel-set-bypass-cookie: true` makes Vercel store the bypass "as a
 *    cookie using a redirect with a `Set-Cookie` header", so follow-up requests
 *    (in-browser testing) no longer need the header. That cookie is what the
 *    other Playwright projects depend on, because they carry only
 *    `storageState` — they never re-send the header.
 *
 * Asserting that a *named* cookie exists would be a weak proxy: it passes even
 * when the cookie is later rejected, and it breaks whenever Vercel renames its
 * internal cookie. This module proves the cookie by behaviour instead — the
 * bypass route is removed and the request is replayed, so only the stored
 * cookie can grant access the second time.
 */

/** Title of the real iPix root page (`src/app/(marketing)/page.tsx`). */
export const IPIX_ROOT_TITLE = /iPix/;

type BypassContext = Pick<BrowserContext, "route" | "unroute" | "cookies">;
type BypassPage = Pick<Page, "goto" | "url" | "title">;

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

/**
 * Adds the bypass headers to requests for the deployment origin only, so the
 * secret is never sent to a third-party origin.
 *
 * The handler's parameter is annotated on the inner function rather than on a
 * named return type: a function *type* expression names a parameter that has
 * no body to use it, which Codacy reports as "'route' is defined but never
 * used" (the repo defines no ESLint config, so Codacy's defaults are the gate).
 */
export function scopedBypassRoute(
  deploymentOrigin: string,
  headers: Record<string, string>,
) {
  return async (route: Route): Promise<void> => {
    const request = route.request();
    if (originOf(request.url()) !== deploymentOrigin) {
      await route.continue();
      return;
    }
    await route.continue({ headers: { ...request.headers(), ...headers } });
  };
}

/**
 * Clears Deployment Protection once, then replays the request with the bypass
 * header removed. Throws with the precise cause when either half fails, so a
 * rejected secret, a missing cookie and an SSO fallback are never confused.
 */
export async function establishAndProveVercelBypass(options: {
  context: BypassContext;
  page: BypassPage;
  deploymentOrigin: string;
  headers: Record<string, string>;
}): Promise<void> {
  const { context, page, deploymentOrigin, headers } = options;

  const cookiesBefore = await context.cookies(deploymentOrigin);

  const withBypassHeader = scopedBypassRoute(deploymentOrigin, headers);
  await context.route("**/*", withBypassHeader);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await context.unroute("**/*", withBypassHeader);

  // Count the cookies rather than asserting Vercel's internal cookie name: a
  // rename on Vercel's side must not break this harness.
  const cookiesAfter = await context.cookies(deploymentOrigin);
  if (cookiesAfter.length <= cookiesBefore.length) {
    throw new Error(
      `Vercel Deployment Protection stored no bypass cookie for ${deploymentOrigin}: the bypass request landed on ${page.url()}. ` +
        "Check that VERCEL_AUTOMATION_BYPASS_SECRET is an active \"Protection Bypass for Automation\" secret for this project.",
    );
  }

  // The proof. The bypass route is gone, so if this navigation still reaches
  // iPix it is the stored cookie doing the work — which is exactly what the
  // projects carrying only storageState rely on. Assert app-owned content, not
  // a Vercel redirect detail.
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const landed = page.url();
  const title = await page.title();
  if (originOf(landed) !== deploymentOrigin || !IPIX_ROOT_TITLE.test(title)) {
    throw new Error(
      `The stored Vercel bypass cookie did not grant access to ${deploymentOrigin} once the bypass header was removed — landed on ${landed} (title "${title}"). ` +
        "Deployment Protection is answering with its SSO screen, so the other Playwright projects would not reach iPix either.",
    );
  }
}

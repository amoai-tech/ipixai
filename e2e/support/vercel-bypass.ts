import type { BrowserContext, Page, Route } from "@playwright/test";
import { verifyVercelDeploymentOwnership } from "./vercel-ownership";

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
 * True only when the real iPix app answers on the exact target origin.
 *
 * A Vercel SSO screen can return HTTP 200 on the deployment host but has a
 * different title; a redirect off-origin is rejected too. Public staged
 * Production candidates return the app without a Deployment Protection
 * cookie, so they must not be forced through the protected-preview bypass.
 */
export function isPublicIpixLanding(input: {
  landed: string;
  title: string;
  deploymentOrigin: string;
}): boolean {
  return (
    originOf(input.landed) === input.deploymentOrigin &&
    IPIX_ROOT_TITLE.test(input.title)
  );
}

const STAGED_PRODUCTION_HOST = /^ipixai-[a-z0-9-]+-amo-agency\.vercel\.app$/i;

type StagedProductionQaEnv = {
  IPIX_STAGED_PRODUCTION_QA?: string;
  VERCEL_DEPLOYMENT_SHA?: string;
};

/**
 * Explicit opt-in for the release workflow's staged-Production QA.
 *
 * The normal E2E harness is Preview-only (AGENTS.md: `E2E_BASE_URL` may only
 * be localhost or an iPix Vercel Preview, never Production). A staged
 * Production candidate is public, so it has no Deployment Protection cookie;
 * accepting it without this guard would let ordinary E2E target Production.
 * Requiring both the flag and the exact staged SHA keeps that path release-only
 * and auditable. The release workflow sets both values.
 */
export function isStagedProductionQaOptIn(
  env: StagedProductionQaEnv = process.env as StagedProductionQaEnv,
): boolean {
  const sha = env.VERCEL_DEPLOYMENT_SHA?.trim() ?? "";
  return env.IPIX_STAGED_PRODUCTION_QA === "1" && /^[a-f0-9]{40}$/i.test(sha);
}

function isLocalOrigin(origin: string): boolean {
  try {
    const candidate = new URL(origin);
    return (
      (candidate.protocol === "http:" || candidate.protocol === "https:") &&
      candidate.origin === origin &&
      !candidate.username &&
      !candidate.password &&
      (candidate.hostname === "localhost" ||
        candidate.hostname === "127.0.0.1" ||
        candidate.hostname === "[::1]")
    );
  } catch {
    return false;
  }
}

/**
 * Establish access for one E2E target.
 *
 * Probe before asking for the bypass secret, so a public staged candidate does
 * not fail the "secret is required" check before it can be classified. A public
 * app is accepted only through the explicit staged-Production opt-in above;
 * a protected Preview still takes the unchanged cookie-proof path below.
 */
export async function establishDeploymentAccess(options: {
  context: BypassContext;
  page: BypassPage;
  deploymentOrigin: string;
  headers: () => Promise<Record<string, string> | undefined>;
  env?: StagedProductionQaEnv;
}): Promise<void> {
  const { context, page, deploymentOrigin, headers } = options;

  if (isLocalOrigin(deploymentOrigin)) return;

  await page.goto("/", { waitUntil: "domcontentloaded" });
  if (
    isPublicIpixLanding({
      landed: page.url(),
      title: await page.title(),
      deploymentOrigin,
    })
  ) {
    if (!isStagedProductionQaOptIn(options.env)) {
      throw new Error(
        "A public deployment reached the E2E harness outside the normal Preview policy. " +
          "Set IPIX_STAGED_PRODUCTION_QA=1 and VERCEL_DEPLOYMENT_SHA only for an authorized, exact-SHA staged Production release run.",
      );
    }
    const hostname = new URL(deploymentOrigin).hostname;
    if (!STAGED_PRODUCTION_HOST.test(hostname)) {
      throw new Error(
        `Staged Production QA is limited to this project's iPix Vercel host; refusing ${hostname}.`,
      );
    }
    // The host shape is only a preflight; hyphenated team slugs can mimic it.
    // Prove actual ownership, READY status, commit and Production target before
    // the E2E operator signs in. Missing credentials/API failures fail closed.
    await verifyVercelDeploymentOwnership(deploymentOrigin, {
      expectedSha: (options.env ?? process.env).VERCEL_DEPLOYMENT_SHA?.trim(),
      expectedTarget: "production",
    });
    return;
  }

  const bypass = await headers();
  if (!bypass) {
    throw new Error(
      "This Vercel target is protected but no bypass headers were returned; refusing to run authenticated QA.",
    );
  }
  await establishAndProveVercelBypass({
    context,
    page,
    deploymentOrigin,
    headers: bypass,
  });
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

import { describe, expect, it } from "vitest";

import { isPublicIpixLanding } from "../e2e/support/vercel-bypass";

const ORIGIN = "https://ipixai-3pz8ibr1k-amo-agency.vercel.app";

describe("isPublicIpixLanding", () => {
  it("treats the real public iPix app on the exact staged origin as public", () => {
    expect(
      isPublicIpixLanding({
        landed: `${ORIGIN}/`,
        title: "iPix — AI-Powered Content Studio for Fashion Brands",
        deploymentOrigin: ORIGIN,
      }),
    ).toBe(true);
  });

  it("does not treat Vercel's SSO screen as the public app", () => {
    expect(
      isPublicIpixLanding({
        landed: "https://vercel.com/sso/verify?next=https%3A%2F%2Fipixai-3pz8ibr1k-amo-agency.vercel.app%2F",
        title: "Vercel Authentication",
        deploymentOrigin: ORIGIN,
      }),
    ).toBe(false);
  });

  it("rejects an iPix-looking response on a different origin", () => {
    expect(
      isPublicIpixLanding({
        landed: "https://www.ipix.co/",
        title: "iPix — AI-Powered Content Studio for Fashion Brands",
        deploymentOrigin: ORIGIN,
      }),
    ).toBe(false);
  });

  it("rejects an SSO-looking page served on the deployment host", () => {
    expect(
      isPublicIpixLanding({
        landed: `${ORIGIN}/`,
        title: "Vercel Authentication",
        deploymentOrigin: ORIGIN,
      }),
    ).toBe(false);
  });

  it("rejects an empty or unparseable landing URL", () => {
    expect(
      isPublicIpixLanding({
        landed: "",
        title: "iPix",
        deploymentOrigin: ORIGIN,
      }),
    ).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { brandEvidenceSchema, brandProfileSchema, isHttpUrl } from "@/lib/brand/brand-profile-contract";

/**
 * IPI-1093 · BRAND-INTEL-001 (task-verifier finding) — evidence.sourceUrl
 * and profile.sourceUrl are rendered directly as `<a href>` in
 * BrandDNAReviewCard. `z.string().url()` alone accepts `javascript:`/`data:`
 * schemes (confirmed live against the installed zod build), which would be
 * a stored-XSS vector for AI/crawler-derived content. Proves the fix
 * actually rejects the schemes the bot named, not just that "validation
 * exists" in the abstract.
 */

const BASE_PROFILE = {
  schemaVersion: 2,
  name: "Acme",
  tagline: { value: "T", evidence: [{ sourceUrl: "https://acme.co", quote: "q" }] },
  category: { value: "C", evidence: [{ sourceUrl: "https://acme.co", quote: "q" }] },
  targetAudience: { value: "A", evidence: [{ sourceUrl: "https://acme.co", quote: "q" }] },
  visualIdentity: { colors: ["#fff"], mood: "m" },
  sourceUrl: "https://acme.co",
  scores: { visual: 80, audience: 70, consistency: 60, commerce_readiness: 50 },
};

describe("brandEvidenceSchema sourceUrl", () => {
  it.each(["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:msgbox(1)"])(
    "rejects %s",
    (unsafeUrl) => {
      const result = brandEvidenceSchema.safeParse({ sourceUrl: unsafeUrl, quote: "q" });
      expect(result.success).toBe(false);
    },
  );

  it.each(["https://acme.co/about", "http://acme.co"])("accepts %s", (safeUrl) => {
    const result = brandEvidenceSchema.safeParse({ sourceUrl: safeUrl, quote: "q" });
    expect(result.success).toBe(true);
  });
});

describe("brandProfileSchema sourceUrl and nested evidence", () => {
  it("rejects a javascript: sourceUrl on the profile itself", () => {
    const result = brandProfileSchema.safeParse({ ...BASE_PROFILE, sourceUrl: "javascript:alert(1)" });
    expect(result.success).toBe(false);
  });

  it("rejects a javascript: sourceUrl nested inside claim evidence", () => {
    const result = brandProfileSchema.safeParse({
      ...BASE_PROFILE,
      tagline: { value: "T", evidence: [{ sourceUrl: "javascript:alert(1)", quote: "q" }] },
    });
    expect(result.success).toBe(false);
  });

  it("accepts the same profile with only http(s) URLs", () => {
    const result = brandProfileSchema.safeParse(BASE_PROFILE);
    expect(result.success).toBe(true);
  });
});

describe("isHttpUrl (task-verifier finding — also guards brands.brand_url render site)", () => {
  it.each(["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "not a url", ""])(
    "rejects %s",
    (unsafe) => {
      expect(isHttpUrl(unsafe)).toBe(false);
    },
  );

  it.each(["https://acme.co", "http://acme.co"])("accepts %s", (safe) => {
    expect(isHttpUrl(safe)).toBe(true);
  });
});

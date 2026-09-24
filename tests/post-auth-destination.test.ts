import { describe, expect, it } from "vitest";
import {
  postAuthDestinationFor,
  safeRedirect,
} from "../src/lib/auth/post-auth-destination";

const operator = { id: "11111111-1111-4111-8111-111111111111", name: "qa@example.com" };

describe("safeRedirect", () => {
  it("IPI-1058 · MARKETING-LOGIN-001 — Reuse the Proven iPix Login Experience With the New Supabase Auth Setup: accepts allowlisted internal destinations", () => {
    expect(safeRedirect("/app")).toBe("/app");
    expect(safeRedirect("/onboarding")).toBe("/onboarding");
  });

  it("IPI-1311 · AUTH-ORG-SINGLE-001 — rejects /org-selection: it is no longer a normal route or post-auth destination", () => {
    expect(safeRedirect("/org-selection")).toBeNull();
  });

  it("IPI-1058 · MARKETING-LOGIN-001 — Reuse the Proven iPix Login Experience With the New Supabase Auth Setup: preserves a query string on an allowlisted internal target", () => {
    expect(safeRedirect("/app?tab=brands")).toBe("/app?tab=brands");
  });

  it("rejects external URLs", () => {
    expect(safeRedirect("https://evil.example")).toBeNull();
    expect(safeRedirect("http://evil.example")).toBeNull();
  });

  it("rejects protocol-relative URLs", () => {
    expect(safeRedirect("//evil.example")).toBeNull();
  });

  it("rejects javascript: and other schemes", () => {
    expect(safeRedirect("javascript:alert(1)")).toBeNull();
    expect(safeRedirect("data:text/html,<script>1</script>")).toBeNull();
  });

  it("rejects backslash tricks and malformed values", () => {
    expect(safeRedirect("/\\evil.example")).toBeNull();
    expect(safeRedirect("")).toBeNull();
    expect(safeRedirect(null)).toBeNull();
    expect(safeRedirect(undefined)).toBeNull();
  });

  it("rejects non-allowlisted internal paths", () => {
    expect(safeRedirect("/admin")).toBeNull();
    expect(safeRedirect("/login")).toBeNull();
  });

  it("IPI-1225 · PLANNER-ROUTE-RETIRE-001 — rejects /planner: it is a compatibility redirect (src/app/planner/page.tsx), never a post-auth target", () => {
    expect(safeRedirect("/planner")).toBeNull();
    expect(safeRedirect("/planner?tab=threads")).toBeNull();
  });
});

describe("postAuthDestinationFor", () => {
  it("IPI-1058 · MARKETING-LOGIN-001 — Reuse the Proven iPix Login Experience With the New Supabase Auth Setup: routes zero memberships to /onboarding", async () => {
    const destination = await postAuthDestinationFor({
      operator,
      listOrgIds: async () => ({ ok: true, orgIds: [] }),
    });
    expect(destination).toBe("/onboarding");
  });

  it("routes one membership to /app", async () => {
    const destination = await postAuthDestinationFor({
      operator,
      listOrgIds: async () => ({
        ok: true,
        orgIds: ["22222222-2222-4222-8222-222222222222"],
      }),
    });
    expect(destination).toBe("/app");
  });

  it("IPI-1311 · AUTH-ORG-SINGLE-001 — fails closed to /login on a membership-conflict invariant violation, never picks a membership", async () => {
    const destination = await postAuthDestinationFor({
      operator,
      listOrgIds: async () => ({
        ok: true,
        orgIds: [
          "22222222-2222-4222-8222-222222222222",
          "33333333-3333-4333-8333-333333333333",
        ],
      }),
    });
    expect(destination).toBe("/login");
  });

  it("fails closed to /login on lookup failure", async () => {
    const destination = await postAuthDestinationFor({
      operator,
      listOrgIds: async () => ({ ok: false }),
    });
    expect(destination).toBe("/login");
  });

  it("fails closed to /login when the membership lookup rejects", async () => {
    const destination = await postAuthDestinationFor({
      operator,
      listOrgIds: async () => {
        throw new Error("database unavailable");
      },
    });
    expect(destination).toBe("/login");
  });

  it("ignores malformed membership ids", async () => {
    const destination = await postAuthDestinationFor({
      operator,
      listOrgIds: async () => ({
        ok: true,
        orgIds: ["not-a-uuid", "22222222-2222-4222-8222-222222222222"],
      }),
    });
    expect(destination).toBe("/app");
  });
});
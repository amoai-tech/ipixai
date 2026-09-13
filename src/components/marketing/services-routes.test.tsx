import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SERVICES } from "./services";

// IPI-1060 · MARKETING-SERVICES-001 — the registry contract (services.test.tsx)
// only proves the 5 hrefs are well-formed; it doesn't prove a page.tsx exists
// for each one. This is the cheap static check that closes that gap before
// any browser/build proof.
describe("SERVICES routes exist on disk (IPI-1060)", () => {
  it("has a page.tsx for every canonical service href", () => {
    for (const service of SERVICES) {
      const slug = service.href.replace(/^\/services\//, "");
      const pagePath = path.join(process.cwd(), "src/app/(marketing)/services", slug, "page.tsx");
      expect(existsSync(pagePath), `missing ${pagePath} for ${service.href}`).toBe(true);
    }
  });
});

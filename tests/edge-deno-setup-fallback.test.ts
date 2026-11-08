import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
const edge = workflow.split("\n  edge-deno:\n")[1]?.split("\n  vercel-production:\n")[0] ?? "";

describe("Edge Deno verified artifact fallback", () => {
  it("keeps the pinned official setup action as primary and inspects its actual failure", () => {
    expect(edge).toContain("denoland/setup-deno@22d081ff2d3a40755e97629de92e3bcbfa7cf2ed");
    expect(edge).toContain('deno-version: "2.9.2"');
    expect(edge).toContain("id: setup_deno");
    expect(edge).toContain("continue-on-error: true");
    expect(edge).toContain("if: steps.setup_deno.outcome == 'failure'");
  });

  it("only runs a SHA256-verified official v2.9.2 Linux binary as fallback", () => {
    expect(edge).toContain("https://dl.deno.land/release/v2.9.2/deno-x86_64-unknown-linux-gnu.zip");
    expect(edge).toContain("934d1bd5cb09eaed7f2e4a4fc58208d04a3c5c0fcde9f319d93d735265c67a4a");
    expect(edge).toContain("sha256sum -c -");
    expect(edge).toContain('>> "$GITHUB_PATH"');
    expect(edge).not.toContain("curl | sh");
    expect(edge).not.toContain("retry-all-errors");
  });

  it("unconditionally asserts exact Deno version and still executes tests/checks", () => {
    expect(edge).toContain("Require exact Deno 2.9.2");
    expect(edge).toContain("deno --version | grep -Eq '^deno 2[.]9[.]2 '");
    expect(edge).toContain("run: deno ci");
    expect(edge).toContain("run: deno task test");
    expect(edge).toContain("deno check --frozen");
  });
});

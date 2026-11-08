import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
const edge = workflow.split("\n  edge-deno:\n")[1]?.split("\n  vercel-production:\n")[0] ?? "";

const require = createRequire(import.meta.url);
const { safeLoad } = require("js-yaml") as { safeLoad: (text: string) => unknown };
type Step = { name?: string; run?: string };
type Config = { jobs?: { "edge-deno"?: { steps?: Step[] } } };
const config = safeLoad(workflow) as Config;
const fallbackScript = config.jobs?.["edge-deno"]?.steps?.find(
  (step) => step.name === "Install checksum-verified Deno from official CDN when setup fails",
)?.run;

// Run the real workflow command block, not a rewritten example. Only network
// download and extraction are stubbed; the real sha256sum verifies the ZIP.
function runFallback(failDownload = false) {
  const dir = mkdtempSync(path.join(tmpdir(), "ipix-deno-fallback-"));
  try {
    const bin = path.join(dir, "bin");
    mkdirSync(bin);
    const archive = path.join(dir, "corrupted.zip");
    const githubPath = path.join(dir, "github-path");
    const unzipMarker = path.join(dir, "unzip-called");
    writeFileSync(archive, "not the official Deno release ZIP");
    writeFileSync(githubPath, "existing-entry\n");

    const curl = path.join(bin, "curl");
    writeFileSync(curl, `#!/bin/sh
if [ "$MOCK_FAIL_DOWNLOAD" = "1" ]; then exit 22; fi
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-o" ]; then
    shift
    cp "$MOCK_ARCHIVE" "$1"
    exit $?
  fi
  shift
done
exit 2
`);
    chmodSync(curl, 0o755);

    const unzip = path.join(bin, "unzip");
    writeFileSync(unzip, '#!/bin/sh\nprintf "extraction attempted\\n" > "$MOCK_UNZIP_MARKER"\n');
    chmodSync(unzip, 0o755);

    const result = spawnSync("bash", ["--noprofile", "--norc", "-eo", "pipefail", "-c", fallbackScript ?? ""], {
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH ?? ""}`,
        RUNNER_TEMP: dir,
        GITHUB_PATH: githubPath,
        MOCK_ARCHIVE: archive,
        MOCK_FAIL_DOWNLOAD: failDownload ? "1" : "0",
        MOCK_UNZIP_MARKER: unzipMarker,
      },
      encoding: "utf8",
      timeout: 10_000,
    });
    return {
      exitCode: result.status,
      output: result.stdout + result.stderr,
      extracted: existsSync(unzipMarker),
      pathContent: readFileSync(githubPath, "utf8"),
      downloaded: existsSync(path.join(dir, "deno-v2.9.2-linux.zip")),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

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
    expect(fallbackScript).toContain('sha256sum -c -');
    expect(fallbackScript).toContain('unzip -q "$DENO_ZIP" -d "$DENO_DIR"');
  });

  it("rejects a corrupted download before extraction or changing GITHUB_PATH", () => {
    expect(fallbackScript).toBeTruthy();
    const result = runFallback();
    expect(result.downloaded).toBe(true);
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toContain("deno-v2.9.2-linux.zip: FAILED");
    expect(result.extracted).toBe(false);
    expect(result.pathContent).toBe("existing-entry\n");
  });

  it("fails closed when the fallback download itself fails", () => {
    expect(fallbackScript).toBeTruthy();
    const result = runFallback(true);
    expect(result.exitCode).not.toBe(0);
    expect(result.downloaded).toBe(false);
    expect(result.extracted).toBe(false);
    expect(result.pathContent).toBe("existing-entry\n");
  });

  it("unconditionally asserts exact Deno version and still executes tests/checks", () => {
    expect(edge).toContain("Require exact Deno 2.9.2");
    expect(edge).toContain("deno --version | grep -Eq '^deno 2[.]9[.]2 '");
    expect(edge).toContain("run: deno ci");
    expect(edge).toContain("run: deno task test");
    expect(edge).toContain("deno check --frozen");
  });
});

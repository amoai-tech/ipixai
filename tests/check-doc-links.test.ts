import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  collectDocumentationFailures,
  resolveLocalTarget,
} from "../scripts/check-doc-links.mjs";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("documentation link checker", () => {
  it("resolves root-relative docs links from the repository root", () => {
    const root = "/repo";
    expect(resolveLocalTarget("/repo/docs/guide.md", "/docs/prd.md", root)).toBe(
      path.join(root, "docs/prd.md"),
    );
  });

  it("rejects local links that escape the repository root", () => {
    expect(resolveLocalTarget("/repo/docs/guide.md", "../../outside.md", "/repo")).toBe(null);
  });

  it("reports local links that escape the repository root", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ipix-docs-check-"));
    tempDirs.push(root);
    fs.mkdirSync(path.join(root, "docs"), { recursive: true });
    fs.writeFileSync(path.join(root, "docs", "README.md"), "[outside](../../outside.md)\n");

    expect(collectDocumentationFailures(root)[0]).toContain("escapes repository root");
  });

  it("fails when obsolete Mintlify files are recreated", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ipix-docs-check-"));
    tempDirs.push(root);
    fs.mkdirSync(path.join(root, "docs"), { recursive: true });
    fs.writeFileSync(path.join(root, "docs", "README.md"), "# Docs\n");
    fs.writeFileSync(path.join(root, "docs", "docs.json"), "{}\n");

    expect(collectDocumentationFailures(root)).toContain(
      "docs/docs.json should not exist; iPix docs are GitHub-native.",
    );
  });
});

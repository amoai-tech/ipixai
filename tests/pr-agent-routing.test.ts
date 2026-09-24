import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { selectSkills } from "../scripts/select-pr-agent-skills.mjs";

const names = (files: string[]) => selectSkills(files).skills;

const SOURCE_FILE = /\.(?:[cm]?[jt]sx?)$/;

function sourceFiles(dir = "src"): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name).replaceAll("\\", "/");
    if (entry.isDirectory()) return sourceFiles(path);
    return SOURCE_FILE.test(entry.name) ? [path] : [];
  });
}

function copilotOwners(): string[] {
  return sourceFiles().filter((file) =>
    /(?:from\s*|import\s*)["']@(copilotkit|ag-ui)\//.test(readFileSync(file, "utf8")),
  );
}

describe("IPI-1246 PR-Agent changed-file routing", () => {
  it("always loads universal code review only for unrelated docs", () => {
    expect(names(["README.md"])).toEqual(["code-review"]);
  });

  it("routes Supabase, auth, and migration changes", () => {
    expect(names(["supabase/migrations/202609200001_test.sql"])).toEqual(["code-review", "ipix-supabase"]);
    expect(names(["src/lib/supabase/server.ts"])).toEqual(["code-review", "ipix-supabase"]);
    expect(names(["src/app/auth/callback/route.ts"])).toEqual(["code-review", "ipix-supabase", "nextjs-developer"]);
  });

  it("routes Mastra and CopilotKit independently", () => {
    expect(names(["src/mastra/agents/planner.ts"])).toEqual(["code-review", "mastra"]);
    expect(names(["src/app/api/copilotkit/route.ts"])).toEqual(["code-review", "copilotkit", "nextjs-developer"]);
  });

  it("routes every current direct CopilotKit or AG-UI source owner", () => {
    const owners = copilotOwners();
    expect(owners.length).toBeGreaterThan(0);
    for (const file of owners) {
      expect(names([file]), file).toContain("copilotkit");
    }
  });

  it("routes Cloudinary media boundaries", () => {
    expect(names(["src/lib/cloudinary/sign-upload.ts"])).toEqual(["code-review", "cloudinary"]);
    expect(names(["supabase/functions/cloudinary-sign/index.ts"])).toEqual(["code-review", "ipix-supabase", "cloudinary"]);
  });

  it("routes Next.js and CI changes", () => {
    expect(names(["src/app/app/page.tsx"])).toEqual(["code-review", "nextjs-developer"]);
    expect(names([".github/workflows/ci.yml"])).toEqual(["code-review", "ci-review"]);
    expect(names(["scripts/check-env.mjs"])).toEqual(["code-review", "ci-review"]);
  });

  it("does not route generic names to unrelated specialists", () => {
    expect(names(["docs/database-design.md"])).toEqual(["code-review"]);
    expect(names(["src/components/Cloud.tsx"])).toEqual(["code-review"]);
  });

  it("loads all version-sensitive specialists for package changes", () => {
    const result = names(["package.json"]);
    for (const skill of ["copilotkit", "mastra", "ipix-supabase", "cloudinary", "nextjs-developer"]) {
      expect(result).toContain(skill);
    }
    expect(result).not.toContain("ci-review");
  });

  it("keeps context budgets bounded", () => {
    expect(selectSkills(["README.md"]).maxTokens).toBeLessThanOrEqual(2000);
    expect(selectSkills(["package.json"]).maxTokens).toBeLessThanOrEqual(6000);
  });
});

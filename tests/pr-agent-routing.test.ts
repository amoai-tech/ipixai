import { describe, expect, it } from "vitest";
import { selectSkills } from "../scripts/select-pr-agent-skills.mjs";

const names = (files: string[]) => selectSkills(files).skills;

describe("IPI-1246 PR-Agent changed-file routing", () => {
  it("always loads universal code review only for unrelated docs", () => {
    expect(names(["README.md"])).toEqual(["pr-agent-code-review"]);
  });

  it("routes Supabase, auth, and migration changes", () => {
    expect(names(["supabase/migrations/202609200001_test.sql"])).toEqual(["pr-agent-code-review", "supabase-review"]);
    expect(names(["src/lib/supabase/server.ts"])).toEqual(["pr-agent-code-review", "supabase-review"]);
    expect(names(["src/app/auth/callback/route.ts"])).toEqual(["pr-agent-code-review", "supabase-review", "nextjs-review"]);
  });

  it("routes Mastra and CopilotKit independently", () => {
    expect(names(["src/mastra/agents/planner.ts"])).toEqual(["pr-agent-code-review", "mastra"]);
    expect(names(["src/app/api/copilotkit/route.ts"])).toEqual(["pr-agent-code-review", "copilotkit-review", "nextjs-review"]);
  });

  it("routes Cloudinary media boundaries", () => {
    expect(names(["src/lib/cloudinary/sign-upload.ts"])).toEqual(["pr-agent-code-review", "cloudinary-review"]);
    expect(names(["supabase/functions/cloudinary-sign/index.ts"])).toEqual(["pr-agent-code-review", "supabase-review", "cloudinary-review"]);
  });

  it("routes Next.js and CI changes", () => {
    expect(names(["src/app/app/page.tsx"])).toEqual(["pr-agent-code-review", "nextjs-review"]);
    expect(names([".github/workflows/ci.yml"])).toEqual(["pr-agent-code-review", "ci-review"]);
    expect(names(["scripts/check-env.mjs"])).toEqual(["pr-agent-code-review", "ci-review"]);
  });

  it("does not route generic names to unrelated specialists", () => {
    expect(names(["docs/database-design.md"])).toEqual(["pr-agent-code-review"]);
    expect(names(["src/components/Cloud.tsx"])).toEqual(["pr-agent-code-review"]);
  });

  it("loads all version-sensitive specialists for package changes", () => {
    const result = names(["package.json"]);
    for (const skill of ["copilotkit-review", "mastra", "supabase-review", "cloudinary-review", "nextjs-review"]) {
      expect(result).toContain(skill);
    }
    expect(result).not.toContain("ci-review");
  });

  it("keeps context budgets bounded", () => {
    expect(selectSkills(["README.md"]).maxTokens).toBeLessThanOrEqual(2000);
    expect(selectSkills(["package.json"]).maxTokens).toBeLessThanOrEqual(6000);
  });
});

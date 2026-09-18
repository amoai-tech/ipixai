import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("IPI-1229 bundle boundaries", () => {
  it("keeps generic operator auth independent from CopilotKit and Mastra thread code", () => {
    const operatorAuthPath = resolve(
      process.cwd(),
      "src/lib/auth/operator-auth.ts",
    );

    expect(existsSync(operatorAuthPath)).toBe(true);
    if (!existsSync(operatorAuthPath)) return;

    const operatorAuth = readFileSync(operatorAuthPath, "utf8");
    expect(operatorAuth).not.toMatch(/@copilotkit|thread-acl|@\/mastra/);

    for (const path of [
      "src/lib/auth/app-shell.ts",
      "src/lib/auth/redirect-if-authenticated.ts",
      "src/app/planner/page.tsx",
    ]) {
      expect(source(path)).not.toContain("copilot-hooks");
      expect(source(path)).toMatch(/operator-auth/);
    }
  });
  it("keeps the runtime storage module free of LibSQL native dependencies", () => {
    const pgStore = source("src/mastra/pg-store.ts");
    expect(pgStore).not.toContain("@mastra/libsql");
  });

});

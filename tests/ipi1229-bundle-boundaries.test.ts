import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SRC = resolve(ROOT, "src");

function source(path: string) {
  return readFileSync(resolve(ROOT, path), "utf8");
}

function resolveLocalImport(fromFile: string, specifier: string) {
  const base = specifier.startsWith("@/")
    ? resolve(SRC, specifier.slice(2))
    : specifier.startsWith(".")
      ? resolve(dirname(fromFile), specifier)
      : null;
  if (!base) return null;

  const candidates = extname(base)
    ? [base]
    : [
        `${base}.ts`,
        `${base}.tsx`,
        `${base}.mts`,
        `${base}.cts`,
        resolve(base, "index.ts"),
        resolve(base, "index.tsx"),
      ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function moduleSpecifiers(file: string) {
  const text = readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const result = new Set<string>();

  function visit(node: ts.Node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      result.add(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      result.add(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }

  visit(ast);
  return [...result];
}

function localImportGraph(entry: string) {
  const seen = new Set<string>();
  const edges: Array<{ from: string; specifier: string; resolved: string | null }> = [];

  function walk(file: string) {
    if (seen.has(file)) return;
    seen.add(file);
    for (const specifier of moduleSpecifiers(file)) {
      const resolved = resolveLocalImport(file, specifier);
      edges.push({ from: file, specifier, resolved });
      if (resolved?.startsWith(SRC)) walk(resolved);
    }
  }

  walk(resolve(ROOT, entry));
  return { seen, edges };
}

describe("IPI-1229 bundle boundaries", () => {
  it("keeps generic operator auth transitively independent from CopilotKit and Mastra thread code", () => {
    const operatorAuthPath = resolve(ROOT, "src/lib/auth/operator-auth.ts");
    expect(existsSync(operatorAuthPath)).toBe(true);

    const graph = localImportGraph("src/lib/auth/operator-auth.ts");
    const forbidden = graph.edges.filter(({ specifier, resolved }) => {
      const lowerSpecifier = specifier.toLowerCase();
      const lowerResolved = resolved?.toLowerCase() ?? "";
      return (
        lowerSpecifier.includes("copilot") ||
        lowerSpecifier.startsWith("@mastra") ||
        lowerSpecifier === "mastra" ||
        lowerSpecifier.includes("thread-acl") ||
        lowerResolved.includes("/src/mastra/") ||
        lowerResolved.includes("/thread-acl.") ||
        lowerResolved.includes("/copilotkit/")
      );
    });

    expect(forbidden).toEqual([]);
    expect([...graph.seen]).toContain(resolve(ROOT, "src/lib/auth/verified-operator.ts"));

    for (const path of [
      "src/lib/auth/app-shell.ts",
      "src/lib/auth/redirect-if-authenticated.ts",
      "src/app/planner/page.tsx",
    ]) {
      expect(source(path)).not.toContain("copilot-hooks");
      expect(source(path)).toMatch(/operator-auth/);
    }
  });

  it("keeps runtime storage and production dependencies free of LibSQL", () => {
    expect(source("src/mastra/pg-store.ts")).not.toContain("@mastra/libsql");
    const pkg = JSON.parse(source("package.json")) as {
      dependencies?: Record<string, string>;
    };
    for (const dependency of ["@mastra/libsql", "@libsql/client", "libsql"]) {
      expect(pkg.dependencies).not.toHaveProperty(dependency);
    }
  });
});

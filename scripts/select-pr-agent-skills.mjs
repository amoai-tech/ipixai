#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const UNIVERSAL = "code-review";
const SPECIALISTS = [
  "copilotkit",
  "mastra",
  "ipix-supabase",
  "cloudinary",
  "nextjs-developer",
  "ci-review",
];

const matches = {
  "ipix-supabase": (p) => /(^supabase\/|(^|\/)supabase([\/_.-]|$)|^src\/app\/auth\/|^src\/lib\/auth\/|^src\/(proxy|middleware)\.)/i.test(p),
  "mastra": (p) => /(^|\/)mastra(\/|[-_.])|requestcontext/i.test(p),
  "copilotkit": (p) =>
    /copilotkit|ag-ui/i.test(p) ||
    /^src\/(agent\.ts|app\/layout\.tsx|lib\/auth\/copilot-hooks\.ts|components\/(operator-panel\/(operator-panel|planner-context)\.tsx|restore-mastra-history\.tsx|shoot\/(compose-shoot-plan-renderer|shoot-plan-review-hitl)\.tsx))$/i.test(p),
  "cloudinary": (p) => /cloudinary/i.test(p) || /(^|\/)(media|asset|assets)(\/|[-_.])/i.test(p) && /upload|transform|webhook|signature|delivery/i.test(p),
  "nextjs-developer": (p) => /(^src\/app\/|next\.config\.|^src\/(proxy|middleware)\.)/i.test(p),
  "ci-review": (p) => /^\.github\/workflows\//.test(p) || /^scripts\/(check|verify|smoke)-/i.test(p),
};

function budget(skillCount) {
  if (skillCount <= 1) return 1800;
  if (skillCount === 2) return 3200;
  if (skillCount === 3) return 4500;
  return 6000;
}

export function selectSkills(files) {
  if (!Array.isArray(files)) throw new TypeError("changed files must be an array");
  const selected = new Set([UNIVERSAL]);
  for (const file of files) {
    if (file === "package.json" || file === "package-lock.json") {
      for (const skill of SPECIALISTS.filter((name) => name !== "ci-review")) selected.add(skill);
      continue;
    }
    for (const [skill, matcher] of Object.entries(matches)) {
      if (matcher(file)) selected.add(skill);
    }
  }
  const skills = [UNIVERSAL, ...SPECIALISTS.filter((skill) => selected.has(skill))];
  return {
    skills,
    paths: skills.map((skill) => `/github/workspace/.claude/skills/${skill}`),
    maxTokens: budget(skills.length),
  };
}

function runCli() {
  const rawFiles = process.env.CHANGED_FILES_FILE
    ? readFileSync(process.env.CHANGED_FILES_FILE, "utf8")
    : (process.env.CHANGED_FILES_JSON ?? "[]");
  const files = JSON.parse(rawFiles);
  const result = selectSkills(files);
  for (const skill of result.skills) {
    const file = `.claude/skills/${skill}/SKILL.md`;
    if (!existsSync(file)) throw new Error(`required trusted PR-Agent skill missing: ${file}`);
  }
  process.stdout.write("enabled=true\n");
  process.stdout.write(`paths=${JSON.stringify(result.paths)}\n`);
  process.stdout.write(`max_tokens=${result.maxTokens}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try { runCli(); } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

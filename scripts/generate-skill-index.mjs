import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadRegistry, markdownTableCell, repoRoot, validateRegistry } from "./skill-registry.mjs";

const check = process.argv.includes("--check");
const registry = loadRegistry();
const errors = validateRegistry(registry);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const lines = [
  "<!-- GENERATED FILE — DO NOT EDIT. Run `npm run skills:index` after changing `.agents/skills/registry.json`. -->",
  "# iPix skills",
  "",
  "All skills live in .agents/skills/. Claude Code loads them via npm run agent:claude and the ipix plugin.",
  "",
  "Source of truth: `.agents/skills/registry.json`.",
  "",
  "## Canonical skills",
  "",
  "| Skill | Summary | Owner | Type | Modes | Delegates to | Do not use for |",
  "|---|---|---|---|---|---|---|",
];

for (const [name, entry] of Object.entries(registry.skills).sort(([a], [b]) => a.localeCompare(b))) {
  const modes = entry.modes.length ? entry.modes.map((value) => `\`${value}\``).join(", ") : "—";
  const delegates = entry.delegates_to.length ? entry.delegates_to.map((value) => `\`${value}\``).join(", ") : "—";
  const avoid = entry.do_not_use_for.length ? entry.do_not_use_for.join("; ") : "—";
  lines.push(`| \`${markdownTableCell(name)}\` | ${markdownTableCell(entry.summary)} | ${markdownTableCell(entry.owner)} | ${markdownTableCell(entry.type)} | ${markdownTableCell(modes)} | ${markdownTableCell(delegates)} | ${markdownTableCell(avoid)} |`);
}

const aliasOwners = new Map();
for (const [name, entry] of Object.entries(registry.skills)) {
  for (const alias of entry.replaces ?? []) aliasOwners.set(alias, name);
}
for (const [alias, owner] of Object.entries(registry.deprecated_aliases ?? {})) aliasOwners.set(alias, owner);
lines.push("", "## Consolidated / removed entry points", "", "| Removed entry point | Canonical owner |", "|---|---|");
for (const [alias, owner] of [...aliasOwners.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  lines.push(`| \`${markdownTableCell(alias)}\` | \`${markdownTableCell(owner)}\` |`);
}

lines.push(
  "",
  "## Governance",
  "",
  "- Keep one real skill directory under .agents/skills/.",
  "- Update the registry and files together.",
  "- Validate with npm run skills:registry:check and npm run skills:index:check.",
  "- Check Claude plugin with claude plugin validate .agents.",
);

const output = `${lines.join("\n").replace(/\n+$/, "")}\n`;
const indexPath = resolve(repoRoot, ".agents/skills/index-skills.md");
if (check) {
  const current = readFileSync(indexPath, "utf8");
  if (current !== output) {
    console.error("Skill index is stale. Run `npm run skills:index` and commit the result.");
    process.exit(1);
  }
  console.log("Skill index is current.");
} else {
  writeFileSync(indexPath, output);
  console.log(`Generated ${indexPath}`);
}

import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const agentsRoot = resolve(repoRoot, ".agents/skills");
export const claudeRoot = resolve(repoRoot, ".claude/skills");
export const registryPath = resolve(agentsRoot, "registry.json");

export function loadRegistry() {
  return JSON.parse(readFileSync(registryPath, "utf8"));
}

export function canonicalSkillNames() {
  return readdirSync(agentsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(resolve(agentsRoot, entry.name, "SKILL.md")))
    .map((entry) => entry.name)
    .sort();
}

export function claudeOnlySkillNames() {
  return readdirSync(claudeRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !lstatSync(resolve(claudeRoot, entry.name)).isSymbolicLink())
    .filter((entry) => existsSync(resolve(claudeRoot, entry.name, "SKILL.md")))
    .map((entry) => entry.name)
    .sort();
}

export function validateRegistry(registry = loadRegistry()) {
  const errors = [];
  const actual = canonicalSkillNames();
  const registered = Object.keys(registry.skills).sort();
  if (JSON.stringify(actual) !== JSON.stringify(registered)) {
    const missing = actual.filter((name) => !registered.includes(name));
    const extra = registered.filter((name) => !actual.includes(name));
    if (missing.length) errors.push(`registry missing canonical skills: ${missing.join(", ")}`);
    if (extra.length) errors.push(`registry has non-canonical skills: ${extra.join(", ")}`);
  }

  const requiredArrays = ["modes", "delegates_to", "do_not_use_for"];
  const claudeOnly = new Set(claudeOnlySkillNames());
  const knownOwners = new Set([...Object.keys(registry.skills), ...claudeOnly]);
  for (const [alias, target] of Object.entries(registry.deprecated_aliases ?? {})) {
    if (knownOwners.has(alias)) errors.push(`deprecated alias still exists as a live skill: ${alias}`);
    if (!knownOwners.has(target)) errors.push(`deprecated alias ${alias} points to unknown owner ${target}`);
  }
  for (const [name, entry] of Object.entries(registry.skills)) {
    for (const field of ["owner", "type", "summary", "canonical"]) if (!entry[field]) errors.push(`${name}: missing ${field}`);
    for (const field of requiredArrays) if (!Array.isArray(entry[field])) errors.push(`${name}: ${field} must be an array`);
    if (typeof entry.claude_exposed !== "boolean") errors.push(`${name}: claude_exposed must be boolean`);
    if (entry.canonical !== `.agents/skills/${name}`) errors.push(`${name}: canonical must be .agents/skills/${name}`);

    const claudePath = resolve(claudeRoot, name);
    const exposed = existsSync(claudePath) && lstatSync(claudePath).isSymbolicLink();
    if (exposed !== entry.claude_exposed) errors.push(`${name}: claude_exposed=${entry.claude_exposed} but symlink=${exposed}`);
    if (exposed && realpathSync(claudePath) !== realpathSync(resolve(agentsRoot, name))) errors.push(`${name}: Claude symlink targets the wrong canonical skill`);

    for (const delegate of entry.delegates_to ?? []) {
      if (!(delegate in registry.skills) && !claudeOnly.has(delegate)) errors.push(`${name}: unknown delegate ${delegate}`);
    }
    for (const replaced of entry.replaces ?? []) {
      if (existsSync(resolve(agentsRoot, replaced)) || existsSync(resolve(claudeRoot, replaced))) errors.push(`${name}: replaced skill still exists: ${replaced}`);
    }
    for (const pattern of entry.routing_patterns ?? []) {
      try { new RegExp(pattern, "i"); } catch { errors.push(`${name}: invalid routing regex ${pattern}`); }
    }
  }
  return errors;
}

export function selectSkillForPrompt(prompt, registry = loadRegistry()) {
  const matches = [];
  for (const [name, entry] of Object.entries(registry.skills)) {
    for (const pattern of entry.routing_patterns ?? []) {
      if (new RegExp(pattern, "i").test(prompt)) {
        matches.push(name);
        break;
      }
    }
  }
  return matches.length === 1 ? matches[0] : undefined;
}

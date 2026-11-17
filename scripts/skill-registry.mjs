import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const agentsRoot = resolve(repoRoot, ".agents/skills");
export const registryPath = resolve(agentsRoot, "registry.json");
export const MAX_ROUTING_PROMPT_LENGTH = 20_000; // Bound raw input before normalization to cap routing work.

export function pathEntryExists(path) {
  return lstatSync(path, { throwIfNoEntry: false }) !== undefined;
}

export function markdownTableCell(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

function hasLiteralPhraseAtBoundaries(prompt, phrase) {
  let fromIndex = 0;
  while (fromIndex <= prompt.length - phrase.length) {
    const index = prompt.indexOf(phrase, fromIndex);
    if (index === -1) return false;
    const before = index > 0 ? prompt[index - 1] : "";
    const afterIndex = index + phrase.length;
    const after = afterIndex < prompt.length ? prompt[afterIndex] : "";
    const isWordChar = (char) => /[a-z0-9_]/.test(char);
    if (!isWordChar(before) && !isWordChar(after)) return true;
    fromIndex = index + 1;
  }
  return false;
}

export function loadRegistry() {
  return JSON.parse(readFileSync(registryPath, "utf8"));
}

export function canonicalSkillNames() {
  return readdirSync(agentsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(resolve(agentsRoot, entry.name, "SKILL.md")))
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
  const knownOwners = new Set(Object.keys(registry.skills));
  const aliasClaims = new Map();
  const claimAlias = (alias, owner) => {
    const prior = aliasClaims.get(alias);
    if (prior && prior !== owner) errors.push(`alias ${alias} claimed by both ${prior} and ${owner}`);
    else aliasClaims.set(alias, owner);
  };
  for (const [name, entry] of Object.entries(registry.skills)) {
    for (const alias of Array.isArray(entry.replaces) ? entry.replaces : []) claimAlias(alias, name);
  }
  for (const [alias, target] of Object.entries(registry.deprecated_aliases ?? {})) {
    claimAlias(alias, target);
    const aliasExists = pathEntryExists(resolve(agentsRoot, alias));
    if (knownOwners.has(alias) || aliasExists) errors.push(`deprecated alias still exists as a live skill: ${alias}`);
    if (!knownOwners.has(target)) errors.push(`deprecated alias ${alias} points to unknown owner ${target}`);
  }
  for (const [name, entry] of Object.entries(registry.skills)) {
    for (const field of ["owner", "type", "summary", "canonical"]) if (!entry[field]) errors.push(`${name}: missing ${field}`);
    for (const field of requiredArrays) if (!Array.isArray(entry[field])) errors.push(`${name}: ${field} must be an array`);
    for (const field of ["routing_phrases", "replaces"]) {
      if (entry[field] !== undefined && !Array.isArray(entry[field])) errors.push(`${name}: ${field} must be an array`);
    }
    if (entry.canonical !== `.agents/skills/${name}`) errors.push(`${name}: canonical must be .agents/skills/${name}`);
    if (!pathEntryExists(resolve(agentsRoot, name))) errors.push(`${name}: canonical skill directory missing`);

    for (const delegate of entry.delegates_to ?? []) {
      if (!Object.hasOwn(registry.skills, delegate)) errors.push(`${name}: unknown delegate ${delegate}`);
    }
    for (const replaced of Array.isArray(entry.replaces) ? entry.replaces : []) {
      if (pathEntryExists(resolve(agentsRoot, replaced))) errors.push(`${name}: replaced skill still exists: ${replaced}`);
    }
    for (const phrase of Array.isArray(entry.routing_phrases) ? entry.routing_phrases : []) {
      if (typeof phrase !== "string" || !phrase.trim()) {
        errors.push(`${name}: routing phrase must be a non-empty string`);
        continue;
      }
      if (phrase.length > 200) errors.push(`${name}: routing phrase is too long`);
    }
  }
  return errors;
}

export function selectSkillForPrompt(prompt, registry = loadRegistry()) {
  if (typeof prompt !== "string" || prompt.length > MAX_ROUTING_PROMPT_LENGTH) return undefined;
  const normalizedPrompt = prompt.toLowerCase().replace(/\s+/g, " ").trim();
  const matches = [];
  for (const [name, entry] of Object.entries(registry.skills)) {
    for (const phrase of entry.routing_phrases ?? []) {
      const normalizedPhrase = phrase.toLowerCase().replace(/\s+/g, " ").trim();
      if (normalizedPhrase && hasLiteralPhraseAtBoundaries(normalizedPrompt, normalizedPhrase)) {
        matches.push(name);
        break;
      }
    }
  }
  return matches.length === 1 ? matches[0] : undefined;
}

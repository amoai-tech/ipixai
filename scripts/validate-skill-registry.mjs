import { loadRegistry, validateRegistry } from "./skill-registry.mjs";

const errors = validateRegistry(loadRegistry());
if (errors.length) {
  console.error("Skill registry validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log("Skill registry validation passed.");

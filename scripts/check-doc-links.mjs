import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docsRoot = path.join(root, "docs");
const rootDocs = ["README.md", "prd.md", "SITEMAP.md", "todo.md"];
const markdownLink = /!?\[[^\]]*\]\(([^)]+)\)/g;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full === path.join(docsRoot, "archive")) return [];
      return walk(full);
    }
    return /\.mdx?$/i.test(entry.name) ? [full] : [];
  });
}

function localTarget(source, rawDestination) {
  let destination = rawDestination.trim();
  if (!destination || /^(?:#|https?:\/\/|mailto:|tel:)/i.test(destination)) return null;
  if (destination.startsWith("<") && destination.endsWith(">")) {
    destination = destination.slice(1, -1);
  }
  // Markdown titles after a URL are not used in active iPix docs; ignore any if added.
  destination = destination.split(/\s+/)[0];
  destination = destination.split("#", 1)[0].split("?", 1)[0];
  if (!destination) return null;
  try {
    destination = decodeURIComponent(destination);
  } catch {
    // Keep the raw path; existence check below will report it if invalid.
  }
  return path.resolve(path.dirname(source), destination);
}

const files = [
  ...walk(docsRoot),
  ...rootDocs.map((name) => path.join(root, name)).filter(fs.existsSync),
];

const failures = [];
for (const file of files) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    markdownLink.lastIndex = 0;
    for (const match of line.matchAll(markdownLink)) {
      const target = localTarget(file, match[1]);
      if (target && !fs.existsSync(target)) {
        failures.push(
          `${path.relative(root, file)}:${index + 1} -> ${match[1]} (missing ${path.relative(root, target)})`,
        );
      }
    }
  });
}

for (const obsolete of ["docs/.mintignore", "docs/docs.json", "docs/index.mdx"]) {
  if (fs.existsSync(path.join(root, obsolete))) {
    failures.push(`${obsolete} should not exist; iPix docs are GitHub-native.`);
  }
}

if (failures.length) {
  console.error(`Documentation check failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Documentation check passed: ${files.length} active Markdown/MDX files, no broken local links.`);

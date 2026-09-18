import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const defaultRoot = path.resolve(path.dirname(scriptPath), "..");
const rootPointerDocs = ["README.md", "prd.md", "SITEMAP.md", "todo.md"];
const obsoleteMintlifyFiles = ["docs/.mintignore", "docs/docs.json", "docs/index.mdx"];
const deprecatedTopLevelDocsDirs = [
  "docs/MIGRATE",
  "docs/cloudflare",
  "docs/cursor",
  "docs/design",
  "docs/notes",
  "docs/playwright",
  "docs/roadmap",
];
const markdownLink = /!?\[[^\]]*\]\(([^)]+)\)/g;

function isInsideRoot(target, root) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function walkActiveDocs(dir, archiveRoot) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full === archiveRoot) return [];
      return walkActiveDocs(full, archiveRoot);
    }
    return /\.mdx?$/i.test(entry.name) ? [full] : [];
  });
}
export function resolveLocalTarget(source, rawDestination, root = defaultRoot) {
  let destination = rawDestination.trim();
  if (!destination || destination.startsWith("#")) return null;
  if (destination.startsWith("<") && destination.endsWith(">")) {
    destination = destination.slice(1, -1);
  }
  if (/^(?:https?:\/\/|mailto:|tel:)/i.test(destination)) return null;
  destination = destination.split(/\s+/)[0];
  destination = destination.split("#", 1)[0].split("?", 1)[0];
  if (!destination) return null;
  try {
    destination = decodeURIComponent(destination);
  } catch {
    // Keep the raw path; existence validation reports malformed local targets.
  }

  const target = destination.startsWith("/")
    ? path.resolve(root, `.${destination}`)
    : path.resolve(path.dirname(source), destination);
  return isInsideRoot(target, root) ? target : null;
}

function activeMarkdownFiles(root) {
  const docsRoot = path.join(root, "docs");
  return [
    ...walkActiveDocs(docsRoot, path.join(docsRoot, "archive")),
    ...rootPointerDocs.map((name) => path.join(root, name)).filter(fs.existsSync),
  ];
}
export function collectDocumentationFailures(root = defaultRoot) {
  const files = activeMarkdownFiles(root);
  const failures = [];

  for (const file of files) {
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      markdownLink.lastIndex = 0;
      for (const match of line.matchAll(markdownLink)) {
        const target = resolveLocalTarget(file, match[1], root);
        if (!target) {
          let destination = match[1].trim();
          if (destination.startsWith("<") && destination.endsWith(">")) {
            destination = destination.slice(1, -1);
          }
          if (destination && !/^(?:#|https?:\/\/|mailto:|tel:)/i.test(destination)) {
            failures.push(
              `${path.relative(root, file)}:${index + 1} -> ${match[1]} (escapes repository root)`,
            );
          }
          continue;
        }
        if (!fs.existsSync(target)) {
          failures.push(
            `${path.relative(root, file)}:${index + 1} -> ${match[1]} (missing ${path.relative(root, target)})`,
          );
        }
      }
    });
  }

  for (const obsolete of obsoleteMintlifyFiles) {
    if (fs.existsSync(path.join(root, obsolete))) {
      failures.push(`${obsolete} should not exist; iPix docs are GitHub-native.`);
    }
  }

  const absoluteRoot = path.resolve(root);
  for (const deprecatedDir of deprecatedTopLevelDocsDirs) {
    const target = path.resolve(absoluteRoot, deprecatedDir);
    if (!isInsideRoot(target, absoluteRoot)) {
      failures.push(`${deprecatedDir} resolves outside the repository root.`);
      continue;
    }
    if (fs.existsSync(target)) {
      failures.push(`${deprecatedDir} should not exist; this top-level docs tree was archived.`);
    }
  }
  return failures;
}

export function runDocumentationCheck(root = defaultRoot) {
  const failures = collectDocumentationFailures(root);
  if (failures.length) {
    console.error(`Documentation check failed (${failures.length}):`);
    for (const failure of failures) console.error(`- ${failure}`);
    return 1;
  }
  console.log(
    `Documentation check passed: ${activeMarkdownFiles(root).length} active Markdown/MDX files, no broken local links.`,
  );
  return 0;
}

if (path.resolve(process.argv[1] ?? "") === scriptPath) {
  process.exitCode = runDocumentationCheck();
}

import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCHEMA = "public";
const TARGET = fileURLToPath(new URL("../src/lib/supabase/database.types.ts", import.meta.url));
const CHECK_ONLY = process.argv.includes("--check");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    encoding: "utf8",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `${command} ${args.join(" ")} failed`);
  }

  return result.stdout;
}

// `supabase gen types --local` ignores this project's configured non-default
// database port. Reading status and passing its local DB URL keeps the source
// local while avoiding any linked-project credential or production dependency.
const status = JSON.parse(run("supabase", ["status", "--output", "json"]));
if (!status.DB_URL) {
  throw new Error("Local Supabase DB_URL is unavailable. Run `supabase start` first.");
}

const generated = run("supabase", [
  "gen",
  "types",
  "typescript",
  "--db-url",
  status.DB_URL,
  "--schema",
  SCHEMA,
]).replace(/\n+$/, "\n");

if (CHECK_ONLY) {
  const current = readFileSync(TARGET, "utf8");
  if (current !== generated) {
    throw new Error(
      "Generated Supabase types are stale. Run `npm run supabase:types` after a fresh local replay and commit src/lib/supabase/database.types.ts.",
    );
  }
  process.stdout.write("Supabase types match the fresh local database.\n");
} else {
  writeFileSync(TARGET, generated);
  process.stdout.write("Updated src/lib/supabase/database.types.ts from the fresh local database.\n");
}

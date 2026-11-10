# Local Supabase testing and recovery — verified workstation notes

> **Scope:** Diagnostics for the known iPix workstation issue, not permanent production guidance. Verify current CLI version, project config, worktree and CI before applying. The canonical safeguards remain in [AGENTS.md](../../AGENTS.md).

## Historical verified failure and two proof-specific fallbacks

**Known local-environment breakage (verified 2026-09-28).** On the current workstation setup, `supabase start` fails when the working tree contains the dotenvx-encrypted `.env.local`. This is **not a repository-wide Supabase failure**: CI does not reproduce the conflict, and `supabase-fresh-replay` runs the real `supabase start` plus `supabase db reset --local` path successfully on every pull request (`.github/workflows/ci.yml`). The pinned CLI (`supabase` 2.116.0) aborts before touching Docker:

```text
$ supabase start
failed to parse config: missing private key
```

Cause is bisected, not guessed: the dotenvx-encrypted `.env.local` (values are `encrypted:…`, plus `DOTENV_PUBLIC_KEY_LOCAL`) is the trigger. The identical `supabase/config.toml` run from a directory *without* `.env.local` passes config parsing and starts containers. It is not `config.toml`, not the ambient shell environment, and not `.env.keys`, `.env.test`, `.env.agent`, or `.env.legacy-retired` — each was tested individually.

Two verified fallbacks — choose by the proof you need:

1. **For full Supabase proofs**, run the CLI from a *separate copy* of `supabase/` outside the conflicting working tree, **only after proving isolation from every other worktree's local database**. In the copied `supabase/config.toml`, choose a **unique local `project_id`** and **unused ports** for API, DB, shadow DB, Studio, mail, analytics, edge inspector and every other enabled service. Inspect host listeners (`ss -ltn`), containers (`docker ps -a`) and volumes (`docker volume ls`) before starting; these are **read-only inventory commands**. Confirm no other local project shares the project ID, ports, container names or volume identities. **STOP unless isolation and ownership are established; never stop, reuse, reset or delete another worktree's containers, databases or volumes.** The copied project must not discover the root dotenvx-encrypted `.env.local`. The installed CLI 2.116.0 predates the experimental `supabase stack` feature (requires >=2.119.0), so do not rely on it. **Reference — REFERENCE ONLY:** https://supabase.com/docs/guides/local-development/running-multiple-local-projects (newer CLI isolation options; no CLI upgrade/config redesign in this task).
2. **For Mastra/Postgres-only proofs**, use a verified **isolated** disposable Postgres instance on `127.0.0.1`. **Before any pinned migrations**, provision the prerequisite `anon`, `authenticated` and `service_role` NOLOGIN roles **and** the separate restricted login role, exactly as the `Provision the pinned mastra schema and the runtime role` step in the existing [`mem-001-restart-history` CI job](../../.github/workflows/ci.yml) does. Those SQL commands are for disposable local Postgres **only**, not hosted projects. Then apply this repository's pinned Mastra migrations **in timestamp order** (`20260722093028_mastra_schema_pinned_1_12_0` → `20260722094055_mastra_runtime_grants_and_rls` → `20260822070000_ipi1008_mastra_workflow_definitions` → `20260927194500_ipi1332_mastra_1_71_schema_delta`). The grants/RLS migration requires the roles and core tables; the delta relies on existing RLS. `127.0.0.1` is on the `src/mastra/pg-store.ts` allowlist. **STOP** if database/container identity is shared with another worktree; do not skip role provisioning or create an alternate schema.

Do not silently fall back to a second database provider to work around this. Report the breakage rather than working around it invisibly, and do not delete `.env.local` (the app needs it).


## When this reference applies

Read this only if `supabase start` or the local CLI actually fails, or the task needs an isolated Mastra/Postgres proof. Do not assume every machine has this issue. Never edit or decrypt `.env.local` to bypass this error. Never point a fallback at hosted production. Real database authorization/RLS must still be independently proven by its owning domain task and tests.

**Reference — REFERENCE ONLY:** https://supabase.com/docs/guides/local-development/cli/getting-started (official Supabase CLI local development). Confirm installed version and project config first; do not copy destructive database reset or production migration commands.

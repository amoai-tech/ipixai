# Forward V2 migrations vs production history

**Task:** **IPI-1040 · MIGRATION-001 — Prove New iPix Database Changes Can Be Added Without Replaying Old Migrations**

Hosted proof ran **2026-08-30** against project `nvdlhrodvevgwdsneplk`. Nothing was applied to production. Durable notes: Linear [**IPI-1040 · MIGRATION-001 — Prove New iPix Database Changes Can Be Added Without Replaying Old Migrations**](https://linear.app/amo100/issue/IPI-1040/ipi-1040-migration-001-prove-new-ipix-database-changes-can-be-added) (proof comment) and [PR #22](https://github.com/amoai-tech/ipixai/pull/22). Counts, CLI version, and hashes below are a **snapshot from that date** — re-verify before any later apply.

Think of production’s migration table as a **receipt book**: stamps already paid. Git `origin/main` currently keeps only the **next unpaid receipt** (**IPI-897 · SB-SEC-009 — Lock Down Default Planner Privileges for New Tables**, file `20260825095051_ipi897_revoke_planner_default_privileges.sql`). You do not rewrite the old receipts. You also must not check the two local Docker dump files into a linked push.

## Proven linked path (disposable worktree only)

1. Work from a **clean** `origin/main` worktree. Link the hosted project with the official CLI, then fail closed if the ref is wrong:

   ```bash
   supabase link --project-ref nvdlhrodvevgwdsneplk
   test "$(cat supabase/.temp/project-ref)" = nvdlhrodvevgwdsneplk && echo "PROJECT REF OK" || { echo "WRONG PROJECT REF — STOP, DO NOT PUSH"; exit 1; }
   ```

   Copying `supabase/.temp` from another machine is a local shortcut, not the supported path. Do not run this in a dirty tree that still has dump files `20260824115900` / `20260824120000`.

2. Keep a copy of `20260825095051_ipi897_*.sql` (fetch overwrites *same names* only; the planner default-privileges file is not on the remote ledger, so it stayed).

3. `supabase migration fetch --linked --yes` — **read remote history, write local files**. Production schema and `schema_migrations` do not change.

4. Snapshot **2026-08-30**: 309 history files + the planner default-privileges file = 310 SQL files. A second worktree matched filenames and SHA-256. Re-verify later:

   ```bash
   supabase --version
   supabase migration list --linked
   sha256sum supabase/migrations/20250125000000_extensions_and_enums.sql \
     supabase/migrations/20260824104900_ipi_v2_000_sb_fix_010_restore_media_size_specs_comment.sql \
     supabase/migrations/20260825095051_ipi897_revoke_planner_default_privileges.sql
   ```

5. `supabase migration list --linked` — snapshot: all 309 versions had matching `local` and `remote`; `20260825095051` was `local` only (`remote` empty).

6. `supabase db push --linked --dry-run` is non-mutating. Snapshot **2026-08-30** printed this once (queue is only the planner default-privileges file):

   ```text
   DRY RUN: migrations will *not* be pushed to the database.
   Connecting to remote database...
   Would push these migrations:
    • 20260825095051_ipi897_revoke_planner_default_privileges.sql
   ```

7. Delete the fetched history files. **Do not commit them.** They are a CLI alignment aid, not the git source of truth.

### Snapshot checksums (2026-08-30; recompute with `sha256sum` before trusting)

| File | SHA-256 |
|------|---------|
| First remote `20250125000000_extensions_and_enums.sql` | `86d8507eb89b2f1b4a01dcbf271345fda545813b3aed06255dea51032d9583d1` |
| Latest remote `20260824104900_ipi_v2_000_sb_fix_010_restore_media_size_specs_comment.sql` | `e045c5568a2fab6c1a018585b7fbd115b2b36bd4d9598606df64e4d4cd7df235` |
| Planner default-privileges file (unchanged by fetch) | `6e23a48696177f49587807a7749a9a50c8cd6ab61e9a4d107b77d0e8abd90c7e` |

Snapshot ledger after dry-run (MCP `list_migrations`): **309** rows, latest `20260824104900`. Re-read that API or `migration list --linked` before a later apply.

## Never

- `supabase migration repair` to fake alignment
- `supabase db reset --linked`
- Real `supabase db push --linked` without explicit human approval
- Commit the fetched history files
- Push local dump pair `20260824115900` / `20260824120000` (replays a full schema dump onto hosted)

## History files are not a local Docker baseline

Fetch reconstructs **statements stored in the remote history table**. Two rows are effectively empty (`;\n` only):

- `20260627180000_media_spec_tables.sql`
- `20260703223000_.sql` (remote `name` is **null**)

Replaying those history files with `supabase db reset` is **not** a valid local schema build. Local Docker stays on the dump-replay path documented in skills (`ipix-supabase`); the planner default-privileges file is already the first **forward** V2 file on `origin/main` (CI/staging, not this ticket).

This ticket therefore **did not** run local reset/pgTAP on the fetched history-file set. That is an honest gap, not a reason to repair production.

## Historical production-apply procedure — SUPERSEDED by IPI-1171

The manual production-push procedure originally recorded here is **retired**. It was useful evidence for the 2026-08-30 linked-CLI experiment, but it is no longer an executable iPix production runbook. The detailed old steps remain available in git history and PR #22 if historical reconstruction is ever needed.

Current production path (IPI-1171):

```text
migration PR
→ required checks
→ protected main merge
→ enabled Supabase GitHub Integration applies pending migrations
→ read-only production ledger/object verification
```

Do **not** run a second manual `supabase db push --linked` after merge. Any linked production mutation is reserved for an explicit reviewed recovery/incident procedure.

## CLI semantics verified (2026-08-30; `supabase --version` was 2.111.0)

- `supabase migration fetch --linked` — default `--linked` true
- `supabase db push --linked --dry-run` — non-mutating; output is the block in step 6 above

Official: [migration fetch](https://supabase.com/docs/reference/cli/supabase-migration-fetch), [database migrations](https://supabase.com/docs/guides/local-development/database-migrations), [CLI link](https://supabase.com/docs/reference/cli/supabase-link).

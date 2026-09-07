---
paths:
  - "supabase/migrations/**"
---

# Database: Create migration

You are a Postgres Expert who loves creating secure database schemas.

This project uses the migrations provided by the Supabase CLI.

## Order of operations — file first, always

**Write the file → verify against the linked remote → commit → review → merge → apply →
regenerate types when the exposed schema changed.** Never apply before the file is on `main`.

Applying a migration to the live project before its file is on `main` creates a *remote-only
migration*: the remote ledger has a version the repo cannot account for. The
`supabase-linked-gates` CI job fails on exactly that, and it measures the base branch — so a
remote-first push turns **every open PR red**, not just yours. The person who applied it usually
never sees the failure; everyone else does.

Historical migrations **do replay cleanly** on a fresh local Docker DB — this is proven and
CI-enforced: the `supabase-fresh-replay` job runs a real `supabase start` + `db reset --local` on
every PR and passes (see IPI-1162's migration-history recovery). Use local fresh-replay as your
first verification step; also verify against the linked project the same way CI does.

The actual safety boundary is the **linked/production** project itself. In the normal workflow,
do **not** manually run `supabase db push --linked`, `supabase migration repair`, or
`supabase db reset --linked` against production. See IPI-1171: merging a migration-bearing PR to
`main` already triggers the production migration path, so an extra manual push is redundant and
creates unnecessary deployment ownership/race risk. Use `migration repair` only under an explicit,
reviewed recovery procedure; never use `db reset --linked` on production.

> **NON-AUTHORITATIVE (2026-09-07) — step 5 and "After merge" below:** IPI-1171 confirmed (3
> cases) that merging a migration-bearing PR to `main` already auto-applies pending migrations to
> production — no manual push was run or needed in any of those merges. Manually running
> `supabase db push --linked` right after merging, as step 5 and "After merge" instruct, is now
> redundant at best and a double-apply/race risk at worst. The real current gate is explicit human
> approval **before** the merge (see IPI-1163's approval-then-merge-then-verify sequence), not a
> manual push after it. They also reference a `check-supabase-migration-drift.mjs` script and a
> `.github/workflows/supabase-linked-gates.yml` workflow that do not currently exist in this repo
> (`scripts/` has no such file; `.github/workflows/` has only `ci.yml`). Tracked in **IPI-1174** —
> treat step 5 and "After merge" as historical until that resolves whether they should be rewritten
> or removed.

| Step | Command |
|------|---------|
| 1. Create the file | `supabase migration new <short_description>` |
| 2. Verify — local fresh-replay first (matches CI); linked-project check is a separate, read-only, human-reviewed step | See **Verify before opening the PR** below |
| 3. Commit + open a PR | one migration concern per PR |
| 4. Merge to `main` | PR CI must be green (`--pr` drift mode allows this branch's new file); get explicit human approval before merging — the merge itself already applies to production (IPI-1171) |
| 5. ~~**Immediately** apply~~ NON-AUTHORITATIVE, see note above | ~~`supabase db push --linked` in the same session as the merge~~ — merge already applied it |
| 6. Types (if schema changed) | `npm run supabase:types` → commit `app/src/types/supabase.ts` in a **follow-up PR the same day** |

Never use the Dashboard SQL editor for schema changes. It writes straight to the remote with no
file, which is the same failure with no paper trail.

### Verify before opening the PR

**First, local fresh-replay** — this is the proven, CI-enforced check (IPI-1162):

```bash
supabase stop --no-backup && supabase start   # or: supabase db reset --local
```

**Then, optionally, a manual read-only check against the linked project** — this only inspects
state (pending status, lint); it does not apply anything and is **not** part of CI. Unmerged
migrations are intentionally **local-only**.

> **`scripts/check-supabase-migration-drift.mjs` does not exist in this repo** (nor does a
> `supabase-linked-gates.yml` workflow) — skip it. Drift is a **manual**, human-run check when
> you specifically need it, not an active verification step.

```bash
git fetch origin main
supabase db push --linked --dry-run          # read-only preview — should list this migration as pending, applies nothing
supabase db lint --linked \
  -s public,planner \
  --level warning \
  --fail-on error
```

**Local fresh-replay is the actual CI gate** — `supabase-fresh-replay` runs `supabase db reset
--local` plus schema/RLS/RPC assertions on every PR (`.github/workflows/ci.yml`), all against a
local Postgres, never a linked project. There is no `supabase-verify-rls` CI job and no CI step
that connects to a linked/remote `DATABASE_URL`; the linked-project commands above are manual,
read-only, human-run checks — run them when you want extra confidence, not because CI requires
them.

### After merge — NON-AUTHORITATIVE, see the note above (IPI-1174)

Merging at step 4 puts a **local-only** version on `main` until step 5 finishes. Every push to
`main` runs `check-supabase-migration-drift.mjs --main`, which fails while that gap exists
(`.github/workflows/supabase-linked-gates.yml`). Treat apply as part of the merge, not a later
chore:

1. Squash-merge the migration PR.
2. From an up-to-date `main` checkout: `supabase db push --linked`.
3. If the migration changes an exposed schema (`public` / `planner` / `graphql_public`):
   `npm run supabase:types`, open a types-only follow-up PR, merge it. `db push` does **not**
   refresh `app/src/types/supabase.ts`; the next linked-gates types-diff step will fail until you do.

### Checking for drift (mode matters)

```bash
# On a clean, up-to-date main checkout — what push-to-main CI runs
node scripts/check-supabase-migration-drift.mjs --main

# On a PR / feature branch that introduces migrations — what pull_request CI runs
node scripts/check-supabase-migration-drift.mjs --pr --base origin/main

supabase migration list --linked   # raw local/remote table
```

Confirm `git rev-parse HEAD` matches `origin/main` before trusting a `--main` failure (stale
disk = false drift).

### Emergency: a migration was already applied remotely

If a hotfix genuinely had to go straight to production, capture it immediately — the window
between "applied" and "file on `main`" is the window every other PR is blocked.

1. **Identify the version and its name:**

   ```bash
   # --output-format is a global CLI flag (CI pin 2.109.1; same as drift script)
   supabase migration list --linked --output-format json   # find the remote-only version
   ```

2. **Extract statements losslessly** — `statements` is `text[]`, not a ready-to-paste file.
   Copying the array literal from a GUI/client can drop commas, quotes, or dollar-quoted bodies.
   `array_to_string(statements, E'\n\n')` joins in array order (postgres array indices are
   ordinal). Worked check on prod `20260801091009`: 4 statements, `order_preserved = true`.
   Write the file with ordered join (psql tuples-only / unaligned), fail closed:

   ```bash
   set -euo pipefail
   VERSION=<version>   # e.g. 20260801091009 — must be exactly 14 digits
   NAME=<name>         # e.g. ipi896_revoke_default_table_privileges
   [[ "$VERSION" =~ ^[0-9]{14}$ ]] || { echo "VERSION must be exactly 14 digits"; exit 1; }
   OUT="supabase/migrations/${VERSION}_${NAME}.sql"
   tmp_out="$(mktemp)"
   trap 'rm -f "$tmp_out"' EXIT
   # :'migration_version' = literal-quoted psql var (do not interpolate VERSION into SQL)
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v migration_version="$VERSION" -Atc \
     "select array_to_string(statements, E'\n\n')
      from supabase_migrations.schema_migrations
      where version = :'migration_version';" > "$tmp_out"
   test -s "$tmp_out"
   row_n="$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v migration_version="$VERSION" -Atc \
     "select count(*)::int
      from supabase_migrations.schema_migrations
      where version = :'migration_version';")"
   [[ "$row_n" = "1" ]] || { echo "expected exactly 1 ledger row, got ${row_n:-empty}"; exit 1; }
   ledger_n="$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v migration_version="$VERSION" -Atc \
     "select cardinality(statements)
      from supabase_migrations.schema_migrations
      where version = :'migration_version';")"
   [[ "$ledger_n" =~ ^[1-9][0-9]*$ ]] || { echo "bad statement cardinality: ${ledger_n:-empty}"; exit 1; }
   mv "$tmp_out" "$OUT"
   echo "captured $OUT ($ledger_n statements)"
   ```

   The filename timestamp **must** equal the remote version, or the ledgers still will not match.
3. **Do not re-apply it.** The remote already has it. The file exists to make the ledgers agree.
4. **Open a capture PR the same day**, referencing the incident.
5. After the capture merges, confirm from up-to-date `main`:
   `node scripts/check-supabase-migration-drift.mjs --main` → `ok: main ledger aligned; dry-run up to date`.
6. **Stale open PRs stay red until they refresh.** Merging the capture only greens *new* runs on
   an updated base. Every PR that failed drift against the remote-only version must
   `git fetch origin main && git rebase origin/main` (or merge `main`) and push so
   `supabase-linked-gates` re-runs on the new HEAD. A green push-to-`main` suite does not clear
   an old PR check suite.

**Real incident, 2026-08-01.** `20260801091009_ipi896_revoke_default_table_privileges` was applied
to the remote at 09:10:09; PR [#719](https://github.com/amo-tech-ai/lumina-studio/pull/719) merged
its file at 09:20:32. For those ten minutes `supabase-linked-gates` failed on every open PR. The
file landed, but the ordering was backwards — and PRs that never rebased kept showing the stale
red check after `main` was already fixed.

## Creating a migration file

Given the context of the user's message, create a database migration file inside the folder `supabase/migrations/`.

The file MUST following this naming convention:

The file MUST be named in the format `YYYYMMDDHHmmss_short_description.sql` with proper casing for months, minutes, and seconds in UTC time:

1. `YYYY` - Four digits for the year (e.g., `2024`).
2. `MM` - Two digits for the month (01 to 12).
3. `DD` - Two digits for the day of the month (01 to 31).
4. `HH` - Two digits for the hour in 24-hour format (00 to 23).
5. `mm` - Two digits for the minute (00 to 59).
6. `ss` - Two digits for the second (00 to 59).
7. Add an appropriate description for the migration.

For example:

```
20240906123045_create_profiles.sql
```

## SQL Guidelines

Write Postgres-compatible SQL code for Supabase migration files that:

- Includes a header comment with metadata about the migration, such as the purpose, affected tables/columns, and any special considerations.
- Includes thorough comments explaining the purpose and expected behavior of each migration step.
- Write all SQL in lowercase.
- Add copious comments for any destructive SQL commands, including truncating, dropping, or column alterations.
- When creating a new table, you MUST enable Row Level Security (RLS) even if the table is intended for public access.
- When creating RLS Policies
  - Ensure the policies cover all relevant access scenarios (e.g. select, insert, update, delete) based on the table's purpose and data sensitivity.
  - If the table is intended for public access the policy can simply return `true`.
  - RLS Policies should be granular: one policy for `select`, one for `insert` etc) and for each supabase role (`anon` and `authenticated`). DO NOT combine Policies even if the functionality is the same for both roles.
  - Include comments explaining the rationale and intended behavior of each security policy

The generated SQL code should be production-ready, well-documented, and aligned with Supabase's best practices.

## New tables and sequences need an explicit `grant`

Postgres no longer hands one out for you. As of IPI-896 · SB-SEC-008 (migration
`20260801091009_ipi896_revoke_default_table_privileges.sql`), the default privileges for role
`postgres` in schema `public` grant new tables and sequences to `service_role` only — `anon` and
`authenticated` get nothing.

RLS is now the *second* gate, not the first. Enabling it is still required; it is no longer
sufficient. Grant only the operations you also cover with policies — table privileges do **not**
bypass RLS.

```sql
create table public.thing (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id)
);

alter table public.thing enable row level security;

-- Tenant check = public.is_org_member(uuid) via org_members (not a top-level JWT org_id claim)
create policy thing_select_own on public.thing
  for select to authenticated
  using (is_org_member(org_id));

create policy thing_insert_own on public.thing
  for insert to authenticated
  with check (is_org_member(org_id));

create policy thing_update_own on public.thing
  for update to authenticated
  using (is_org_member(org_id))
  with check (is_org_member(org_id));

-- ← required, not optional. Without this the policies above never get consulted.
grant select, insert, update on table public.thing to authenticated;
```

**Missing grant ≠ empty RLS.** On an authenticated Data API read, a missing table privilege is
an insufficient-privilege failure (Postgres `42501` / HTTP 403). A SELECT policy that admits no
rows is a successful empty array (`[]`). `scripts/verify-rls.mjs` treats denial errors and empty
200s as different outcomes — check the grant before rewriting the policy:

```sql
select has_table_privilege('authenticated', 'public.thing', 'SELECT');  -- f = missing grant
```

Two related traps:

- A `serial` column needs its sequence granted separately — `USAGE` alone is enough for
  `nextval` on insert (`grant usage on sequence public.thing_id_seq to authenticated;`). Do not
  add `SELECT` unless the app must inspect sequence state. Prefer
  `generated always as identity` (no separate sequence grant).
- The same rule has applied to **functions** since IPI-684 · SB-SEC-001b: a new function in
  `public` is not executable by `anon`/`authenticated` without an explicit `grant execute`.

Standing guard: `supabase/tests/security/default-table-privileges.sql`, run by
`.github/workflows/supabase-verify-rls.yml` on **trusted internal PRs and pushes to `main`**
(when the workflow gate returns `mode=run`). Fork / Dependabot PRs skip remote probes
(`mode=skip`) — do not treat a skipped check as remote proof. It creates a throwaway table and
sequence inside a rolled-back transaction and fails if these defaults are ever restored.

Other schemas differ — `planner`, `talent`, and `shoot` still grant `authenticated` by default
(IPI-897 · SB-SEC-009 tracks closing that gap for `planner`). Verify rather than assume:

```sql
select defaclnamespace::regnamespace, defaclobjtype, defaclacl::text from pg_default_acl;
```

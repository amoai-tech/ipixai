#!/usr/bin/env bash
# IPI-1093 · BRAND-INTEL-001 (external audit finding) — proves the
# queued-crawl claim in start-brand-crawl/handler.ts is actually atomic.
#
# The first attempted fix added `.eq("job_status","queued").is("firecrawl_job_id",
# null)` to the claiming UPDATE's WHERE clause but never wrote to either
# column — so the predicate stayed true after a winner committed, and
# Postgres's read-committed re-check semantics (a concurrent UPDATE blocked
# on the same row re-evaluates its WHERE against the latest committed row
# version once unblocked) let a second, concurrent caller's identical
# UPDATE also match and succeed. Verified with two real concurrent psql
# sessions during this task, not reasoned about in the abstract; this
# script is that same proof, permanent and CI-run.
#
# Cannot be expressed in this repo's usual single-connection `psql -f
# file.sql` test pattern (supabase-fresh-replay runs those sequentially,
# one connection each) — this genuinely needs two overlapping database
# sessions, so it's a shell script driving two backgrounded psql processes
# instead of a `.sql` file.
set -euo pipefail

PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-54322}"
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-postgres}"
export PGPASSWORD="${PGPASSWORD:-postgres}"

PSQL=(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1)

WORK_DIR="$(mktemp -d)"
# RUN_TAG makes every fixture row (and the fixture user's unique-constrained
# email) distinct per invocation, so re-running this script locally without
# a full `supabase db reset` never collides with a prior run's leftovers.
RUN_TAG="$(date +%s%N)-$$"
cleanup() {
  "${PSQL[@]}" -t -A -c "delete from public.brands where name = 'IPI1093 Claim Race Brand $RUN_TAG';" >/dev/null 2>&1 || true
  "${PSQL[@]}" -t -A -c "delete from public.organizations where slug = 'ipi1093-claim-race-org-$RUN_TAG';" >/dev/null 2>&1 || true
  "${PSQL[@]}" -t -A -c "delete from auth.users where email = 'ipi1093-claim-race-$RUN_TAG@ipix.test';" >/dev/null 2>&1 || true
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

# --- fixtures: one real brand, one queued/unclaimed crawl row ---------------
FIXTURE_SQL="$WORK_DIR/fixture.sql"
cat > "$FIXTURE_SQL" <<SQL
do \$\$
declare
  v_user uuid := gen_random_uuid();
  v_org uuid := gen_random_uuid();
  v_brand uuid := gen_random_uuid();
  v_crawl uuid := gen_random_uuid();
begin
  insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_user, 'authenticated', 'authenticated', 'ipi1093-claim-race-$RUN_TAG@ipix.test', now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now());

  insert into public.organizations (id, name, slug, type, owner_id, plan)
  values (v_org, 'IPI1093 Claim Race Org $RUN_TAG', 'ipi1093-claim-race-org-$RUN_TAG', 'agency', v_user, 'free');

  insert into public.org_members (org_id, user_id, role) values (v_org, v_user, 'owner')
  on conflict (org_id, user_id) do nothing;

  insert into public.brands (id, user_id, org_id, name)
  values (v_brand, v_user, v_org, 'IPI1093 Claim Race Brand $RUN_TAG');

  insert into public.brand_crawls (id, brand_id, source_url, job_status, firecrawl_job_id)
  values (v_crawl, v_brand, 'https://ipi1093-claim-race.test', 'queued', null);

  raise notice 'FIXTURE_CRAWL_ID=%', v_crawl;
end \$\$;
SQL

CRAWL_ID=$("${PSQL[@]}" -t -A -f "$FIXTURE_SQL" 2>&1 | grep -oE 'FIXTURE_CRAWL_ID=[0-9a-f-]+' | cut -d= -f2) || true
if [ -z "$CRAWL_ID" ]; then
  echo "IPI-1093 FAIL: could not seed the claim-race fixture crawl row" >&2
  exit 1
fi

# --- two concurrent claim attempts, exact same statement shape as the ------
# --- fixed start-brand-crawl/handler.ts claim (job_status set to 'running', --
# --- WHERE job_status='queued' AND firecrawl_job_id IS NULL) ---------------
CLAIM_SQL="$WORK_DIR/claim.sql"
cat > "$CLAIM_SQL" <<SQL
select pg_sleep(random() * 0.2);
update public.brand_crawls
   set job_status = 'running', request_id = gen_random_uuid()::text, updated_at = now()
 where id = '$CRAWL_ID'
   and job_status = 'queued'
   and firecrawl_job_id is null
returning id;
SQL

OUT_A="$WORK_DIR/a.out"
OUT_B="$WORK_DIR/b.out"
"${PSQL[@]}" -t -A -f "$CLAIM_SQL" > "$OUT_A" 2>&1 &
PID_A=$!
"${PSQL[@]}" -t -A -f "$CLAIM_SQL" > "$OUT_B" 2>&1 &
PID_B=$!
wait "$PID_A" "$PID_B"

# Each successful claim prints the row's id (one non-empty data line from
# the RETURNING clause); a lost claim prints nothing for that statement.
CLAIMS_A=$(grep -c "$CRAWL_ID" "$OUT_A" || true)
CLAIMS_B=$(grep -c "$CRAWL_ID" "$OUT_B" || true)
TOTAL_CLAIMS=$((CLAIMS_A + CLAIMS_B))

echo "--- session A output ---"; cat "$OUT_A"
echo "--- session B output ---"; cat "$OUT_B"

if [ "$TOTAL_CLAIMS" -ne 1 ]; then
  echo "IPI-1093 FAIL: expected exactly 1 of 2 concurrent claims to succeed, got $TOTAL_CLAIMS" >&2
  exit 1
fi

FINAL_STATUS=$("${PSQL[@]}" -t -A -c "select job_status from public.brand_crawls where id = '$CRAWL_ID';")
if [ "$FINAL_STATUS" != "running" ]; then
  echo "IPI-1093 FAIL: expected final job_status='running', got '$FINAL_STATUS'" >&2
  exit 1
fi

echo "IPI-1093 brand_crawls claim concurrency PASS (exactly 1 of 2 concurrent claims succeeded)"

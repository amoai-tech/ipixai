#!/usr/bin/env bash
# IPI-1269 · ONBOARD-DB-GUARD-001 — proves materialize_onboarding_session is
# safe under a concurrent double-submit: two overlapping calls with the same
# (user_id, idempotency_key) must still produce exactly one organization, one
# owner org_members row, and one brand, with both calls returning the same
# durable IDs.
#
# The RPC locks the draft row with `select ... for update` before it inserts
# org/brand, so the loser blocks until the winner commits, then re-reads and
# takes the replay branch (see supabase/migrations/
# 20260802081000_materialize_onboarding_replay_select.sql). Needs two real
# overlapping database sessions, which this repo's single-connection
# `psql -f file.sql` pattern can't express — same reason
# ipi1093-brand-crawl-claim-concurrency.sh is a shell script, not SQL.
set -euo pipefail

PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-54322}"
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-postgres}"
export PGPASSWORD="${PGPASSWORD:-postgres}"

PSQL=(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1)

WORK_DIR="$(mktemp -d)"
RUN_TAG="$(date +%s%N)-$$"
USER_EMAIL="ipi1269-dbguard-concurrency-$RUN_TAG@ipix.test"
IDEMPOTENCY_KEY="ipi1269-concurrency-key-$RUN_TAG"

cleanup() {
  "${PSQL[@]}" -t -A -c "delete from public.brands where user_id = (select id from auth.users where email = '$USER_EMAIL');" >/dev/null 2>&1 || true
  "${PSQL[@]}" -t -A -c "delete from public.organizations where owner_id = (select id from auth.users where email = '$USER_EMAIL');" >/dev/null 2>&1 || true
  "${PSQL[@]}" -t -A -c "delete from auth.users where email = '$USER_EMAIL';" >/dev/null 2>&1 || true
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

# --- fixture: one real user with one draft onboarding_sessions row ---------
FIXTURE_SQL="$WORK_DIR/fixture.sql"
cat > "$FIXTURE_SQL" <<SQL
do \$\$
declare
  v_user uuid := gen_random_uuid();
begin
  insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_user, 'authenticated', 'authenticated', '$USER_EMAIL', now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now());

  set local role authenticated;
  execute format('set local request.jwt.claims = %L', json_build_object('sub', v_user)::text);
  insert into public.onboarding_sessions (user_id, idempotency_key) values (v_user, '$IDEMPOTENCY_KEY');
  reset role;

  raise notice 'FIXTURE_USER_ID=%', v_user;
end \$\$;
SQL

USER_ID=$("${PSQL[@]}" -t -A -f "$FIXTURE_SQL" 2>&1 | grep -oE 'FIXTURE_USER_ID=[0-9a-f-]+' | cut -d= -f2) || true
if [ -z "$USER_ID" ]; then
  echo "IPI-1269 FAIL: could not seed the concurrency-race fixture user/draft session" >&2
  exit 1
fi

# --- two concurrent materialize_onboarding_session calls for the same ------
# --- (user_id, idempotency_key) --------------------------------------------
CALL_SQL="$WORK_DIR/call.sql"
cat > "$CALL_SQL" <<SQL
select pg_sleep(random() * 0.2);
-- Session-level (not LOCAL): each concurrent call below runs over its own
-- dedicated psql -f connection (backgrounded separately), and plain
-- top-level statements in a -f script are NOT implicitly wrapped in one
-- transaction, so a transaction-local SET would not survive past the
-- statement that set it. Session-level scoping is still fully isolated
-- between the two concurrent connections.
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '$USER_ID')::text, false);
select public.materialize_onboarding_session('$IDEMPOTENCY_KEY', 'IPI1269 Concurrency Brand', 'https://ipi1269-concurrency.test');
SQL

OUT_A="$WORK_DIR/a.out"
OUT_B="$WORK_DIR/b.out"
"${PSQL[@]}" -t -A -f "$CALL_SQL" > "$OUT_A" 2>&1 &
PID_A=$!
"${PSQL[@]}" -t -A -f "$CALL_SQL" > "$OUT_B" 2>&1 &
PID_B=$!

FAIL=0
wait "$PID_A" || FAIL=1
wait "$PID_B" || FAIL=1

echo "--- session A output ---"; cat "$OUT_A"
echo "--- session B output ---"; cat "$OUT_B"

if [ "$FAIL" -ne 0 ]; then
  echo "IPI-1269 FAIL: one or both concurrent materialize_onboarding_session calls errored (see output above)" >&2
  exit 1
fi

# The RPC's own jsonb_build_object result is the last output line of each run.
# Normalize both JSON values before comparing so key order/whitespace cannot make
# semantically identical results look different. jq -e also fails fast if either
# session unexpectedly returns malformed/non-JSON output.
RESULT_A_RAW=$(tail -n 1 "$OUT_A")
RESULT_B_RAW=$(tail -n 1 "$OUT_B")
if [ -z "$RESULT_A_RAW" ] || [ -z "$RESULT_B_RAW" ]; then
  echo "IPI-1269 FAIL: expected a non-empty materialize result from both concurrent calls" >&2
  exit 1
fi
if ! RESULT_A=$(printf '%s\n' "$RESULT_A_RAW" | jq -e -cS .) || ! RESULT_B=$(printf '%s\n' "$RESULT_B_RAW" | jq -e -cS .); then
  echo "IPI-1269 FAIL: expected valid JSON materialize results from both concurrent calls" >&2
  exit 1
fi
if [ "$RESULT_A" != "$RESULT_B" ]; then
  echo "IPI-1269 FAIL: concurrent calls must return the same durable organization_id/brand_id, got A='$RESULT_A' B='$RESULT_B'" >&2
  exit 1
fi

ORG_COUNT=$("${PSQL[@]}" -t -A -c "select count(*) from public.organizations where owner_id = '$USER_ID';")
BRAND_COUNT=$("${PSQL[@]}" -t -A -c "select count(*) from public.brands where user_id = '$USER_ID';")
MEMBER_COUNT=$("${PSQL[@]}" -t -A -c "select count(*) from public.org_members where user_id = '$USER_ID' and role = 'owner';")
SESSION_STATUS=$("${PSQL[@]}" -t -A -c "select status from public.onboarding_sessions where user_id = '$USER_ID' and idempotency_key = '$IDEMPOTENCY_KEY';")

if [ "$ORG_COUNT" != "1" ]; then
  echo "IPI-1269 FAIL: expected exactly 1 organization after concurrent double-submit, got $ORG_COUNT" >&2
  exit 1
fi
if [ "$BRAND_COUNT" != "1" ]; then
  echo "IPI-1269 FAIL: expected exactly 1 brand after concurrent double-submit, got $BRAND_COUNT" >&2
  exit 1
fi
if [ "$MEMBER_COUNT" != "1" ]; then
  echo "IPI-1269 FAIL: expected exactly 1 owner org_members row after concurrent double-submit, got $MEMBER_COUNT" >&2
  exit 1
fi
if [ "$SESSION_STATUS" != "materialized" ]; then
  echo "IPI-1269 FAIL: expected onboarding_sessions.status='materialized' after concurrent double-submit, got '$SESSION_STATUS'" >&2
  exit 1
fi

echo "IPI-1269 onboard DB guard concurrency PASS (exactly 1 org/brand/owner-member after concurrent double-submit)"

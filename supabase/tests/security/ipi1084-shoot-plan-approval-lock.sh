#!/usr/bin/env bash
# IPI-1084 · APPROVAL-001 — two-session proof that staging and deciding one
# planner run serialise on the same transaction-scoped advisory lock.
#
# Superseded-revision protection has two halves:
#   1. the sequential check in decide_shoot_plan_revision (SUPERSEDED_REVISION),
#      covered by ipi1084-shoot-plan-approval-acl.sql; and
#   2. genuine mutual exclusion, so a concurrent stage cannot slip a newer
#      revision in between that check and the decision write.
# This script proves (2) with two real sessions, and proves the assertion is
# sensitive by repeating it against a different key:
#   * positive: session A holds the exact key both RPCs take, so session B's
#     stage_shoot_plan_revision must wait for A to release it; and
#   * negative control: session A holds key + 1, so the same call must return
#     almost immediately. Without that control a "waited" result could not be
#     distinguished from a slow query.
#
# Usage: bash supabase/tests/security/ipi1084-shoot-plan-approval-lock.sh [port]
set -euo pipefail

port="${1:-54322}"
psql_run() {
  psql -h 127.0.0.1 -p "$port" -U postgres -d postgres -v ON_ERROR_STOP=1 -X -q -A -t "$@"
}

org_id="00000000-0000-4000-8000-0000000000aa"
user_id="00000000-0000-4000-8000-0000000000bb"
brand_id="00000000-0000-4000-8000-0000000000cc"
run_id="ipi1084-lock-proof"
holder_app="ipi1084-lock-holder"
plan_json="{\"objective\":\"lock proof\"}"

cleanup() {
  psql_run -c "
    delete from shoot.shoot_plan_approvals where workflow_run_id = '$run_id';
    delete from public.brands where id = '$brand_id';
    delete from public.organizations where id = '$org_id';
    delete from auth.users where id = '$user_id';
  " >/dev/null 2>&1 || true
}
trap cleanup EXIT

cleanup
psql_run <<SQL >/dev/null
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('$user_id', 'authenticated', 'authenticated', 'ipi1084-lock-proof@ipix.test', now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now());
insert into public.organizations (id, name, slug, type, owner_id)
values ('$org_id', 'IPI-1084 Lock Proof Org', 'ipi1084-lock-proof-org', 'brand_owner', '$user_id');
insert into public.brands (id, user_id, name, org_id)
values ('$brand_id', '$user_id', 'IPI-1084 Lock Proof Brand', '$org_id');
SQL

key="$(psql_run -c "select hashtextextended('$brand_id' || ':' || '$run_id', 0)")"
if [ -z "$key" ]; then
  echo "FAIL: could not derive the staging lock key"
  exit 1
fi

# Hold holder_key for 10s in a second session, wait until pg_locks shows it is
# held (read from the catalog: psql stdout is block-buffered when not a tty),
# then stage and report how long the call took.
hold_and_stage() {
  local holder_key="$1" label="$2"
  psql_run -c "set application_name = '$holder_app'; begin; select pg_advisory_xact_lock($holder_key); select pg_sleep(10); commit;" \
    >/dev/null 2>&1 &
  local holder_pid=$!

  local held="0"
  local _i
  for _i in $(seq 1 100); do
    held="$(psql_run -c "select count(*) from pg_locks l join pg_stat_activity a on a.pid = l.pid where l.locktype = 'advisory' and a.application_name = '$holder_app'")"
    held="$(printf '%s' "$held" | tr -d '[:space:]')"
    [ "$held" = "1" ] && break
    sleep 0.2
  done
  if [ "$held" != "1" ]; then
    echo "FAIL: $label — the proof lock was never acquired"
    kill "$holder_pid" 2>/dev/null || true
    exit 1
  fi

  local start_ns end_ns
  start_ns="$(date +%s%N)"
  staged="$(psql_run -c "select public.stage_shoot_plan_revision('$brand_id', '$run_id', '$plan_json'::jsonb, null, 'ipi1084-lock-proof-thread', null)")"
  end_ns="$(date +%s%N)"
  wait "$holder_pid"

  waited_ms=$(( (end_ns - start_ns) / 1000000 ))
  echo "$label: staging waited ${waited_ms}ms behind a held lock"
}

staged=""
waited_ms=0
hold_and_stage "$key" "shared run lock"
if [ "$waited_ms" -lt 3000 ]; then
  echo "FAIL: stage_shoot_plan_revision did not serialise on the shared run lock"
  echo "lock key: $key"
  echo "staged: $staged"
  exit 1
fi
case "$staged" in
  *'"ok": true'*|*'"ok":true'*) ;;
  *) echo "FAIL: staging did not succeed once the lock was released"; echo "$staged"; exit 1 ;;
esac

hold_and_stage "$(( key + 1 ))" "unrelated lock (negative control)"
if [ "$waited_ms" -ge 2000 ]; then
  echo "FAIL: the timing assertion is not sensitive — staging waited on an unrelated key"
  exit 1
fi

echo "PASS: staging serialises on the shared run advisory lock (and not on an unrelated key)"

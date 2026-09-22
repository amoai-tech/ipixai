#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-54322}"
PSQL=(psql -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -Atq)
export PGPASSWORD="${PGPASSWORD:-postgres}"

ACTOR='30000000-0000-4000-8000-000000000001'
ORG='30000000-0000-4000-8000-00000000000a'
BRAND='30000000-0000-4000-8000-00000000000b'
APPROVAL='30000000-0000-4000-8000-00000000000c'
RUN='ipi1083-concurrency-run'

"${PSQL[@]}" <<SQL
delete from shoot.shoots where approval_id='$APPROVAL';
delete from shoot.shoot_plan_approvals where id='$APPROVAL';
delete from public.brands where id='$BRAND';
delete from public.org_members where org_id='$ORG' or user_id='$ACTOR';
delete from public.organizations where id='$ORG';
delete from auth.users where id='$ACTOR';
insert into auth.users (id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('$ACTOR','authenticated','authenticated','ipi1083-concurrency@ipix.test',now(),'{"provider":"email"}','{}',now(),now());
insert into public.organizations (id,name,slug,type,owner_id)
values ('$ORG','IPI1083 Concurrency','ipi1083-concurrency','brand_owner','$ACTOR');
insert into public.org_members (org_id,user_id,role) values ('$ORG','$ACTOR','owner')
on conflict (org_id,user_id) do update set role=excluded.role;
insert into public.brands (id,user_id,name,org_id) values ('$BRAND','$ACTOR','IPI1083 Concurrency Brand','$ORG');
with p as (
  select '{"channels":["shopify"],"shootName":{"status":"confirmed","value":"Concurrent Shoot","source":"operator"},"brief":{"status":"confirmed","value":"Concurrent save proof","source":"operator"},"shootTypeResult":{"status":"ok","shootType":"ecommerce_pdp"},"budgetResult":{"status":"needs_input"},"deliverablesResult":{"status":"ok","deliverables":[]},"shotListResult":null,"productRefs":[],"referencesUsed":[],"status":"needs_input"}'::jsonb plan
)
insert into shoot.shoot_plan_approvals
  (id,brand_id,workflow_run_id,revision,plan,plan_hash,status,staged_by,decided_by,decided_at)
select '$APPROVAL','$BRAND','$RUN',1,plan,encode(extensions.digest(plan::text,'sha256'),'hex'),'approved','$ACTOR','$ACTOR',now() from p;
SQL

TMP_A="$(mktemp)"; TMP_B="$(mktemp)"; TMP_LOCK="$(mktemp)"; READY="$(mktemp)"
rm -f "$READY"
trap 'rm -f "$TMP_A" "$TMP_B" "$TMP_LOCK" "$READY"' EXIT

# A privileged test-only locker holds the immutable approval row long enough
# for two normal authenticated save calls to overlap inside FOR UPDATE.
(
"${PSQL[@]}" >"$TMP_LOCK" <<SQL
begin;
select id from shoot.shoot_plan_approvals where id='$APPROVAL' for update;
\! touch '$READY'
select pg_sleep(1);
commit;
SQL
) & PID_LOCK=$!

for _ in {1..500}; do
  [[ -f "$READY" ]] && break
  sleep 0.01
done
if [[ ! -f "$READY" ]]; then
  echo "IPI-1083 concurrency harness failed: locker never signalled readiness" >&2
  kill "$PID_LOCK" 2>/dev/null || true
  exit 1
fi
for target in A B; do
  out_var="TMP_${target}"
  out="${!out_var}"
  (
  "${PSQL[@]}" >"$out" <<SQL
begin;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"$ACTOR"}',true);
select public.save_approved_shoot('$APPROVAL');
commit;
SQL
  ) &
  if [[ "$target" == "A" ]]; then PID_A=$!; else PID_B=$!; fi
done

wait "$PID_LOCK"; wait "$PID_A"; wait "$PID_B"

COUNT="$("${PSQL[@]}" -c "select count(*) from shoot.shoots where approval_id='$APPROVAL';")"
IDS="$("${PSQL[@]}" -c "select count(distinct id) from shoot.shoots where approval_id='$APPROVAL';")"
if [[ "$COUNT" != "1" || "$IDS" != "1" ]]; then
  echo "IPI-1083 concurrency failed: rows=$COUNT distinct_ids=$IDS" >&2
  cat "$TMP_A" "$TMP_B" >&2
  exit 1
fi
CREATED=$(grep -h -c '"replayed": false' "$TMP_A" "$TMP_B" | awk '{s+=$1} END{print s+0}')
REPLAYED=$(grep -h -c '"replayed": true' "$TMP_A" "$TMP_B" | awk '{s+=$1} END{print s+0}')
if [[ "$CREATED" != "1" || "$REPLAYED" != "1" ]]; then
  echo "IPI-1083 concurrency failed: expected one create + one replay, got create=$CREATED replay=$REPLAYED" >&2
  cat "$TMP_A" "$TMP_B" >&2
  exit 1
fi

echo "IPI-1083 concurrency PASS: overlapping saves produced exactly one Shoot"

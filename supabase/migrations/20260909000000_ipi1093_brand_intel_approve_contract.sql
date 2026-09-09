-- IPI-1093 · BRAND-INTEL-001 — Approved Brand DNA profile: review/approve/reject contract
--
-- Adds the human-review -> atomic-promotion contract for Brand DNA drafts.
-- Draft truth lives in public.brands.ai_profile_draft (jsonb); this migration:
--   1. adds additive audit columns to public.brands (approved_profile_at already exists live, NOT re-created)
--   2. creates an org-scoped audit table public.brand_profile_approvals
--   3. adds SECURITY DEFINER approve/reject RPCs that promote the EXACT reviewed artifact
--
-- Rollback:
--   drop function public.approve_brand_intelligence_draft(uuid,text);
--   drop function public.reject_brand_intelligence_draft(uuid,text);
--   drop table public.brand_profile_approvals;
--   alter table public.brands drop column if exists approved_by, drop column if exists approved_profile_version, drop column if exists approved_draft_hash;

-- ---------------------------------------------------------------------------
-- 1. Additive audit columns on public.brands
--    approved_profile_at exists on the live project but is absent from the
--    repo migration chain (repo/remote drift); add-if-not-exists keeps both
--    live (no-op) and fresh local/CI replay consistent.
-- ---------------------------------------------------------------------------
alter table public.brands
  add column if not exists approved_profile_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id) on delete set null,
  add column if not exists approved_profile_version integer,
  add column if not exists approved_draft_hash text;

-- ---------------------------------------------------------------------------
-- 2. Org-scoped audit table for Brand DNA review decisions
-- ---------------------------------------------------------------------------
create table if not exists public.brand_profile_approvals (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete restrict,
  draft_hash text not null,
  profile_version integer not null,
  decision text not null check (decision in ('approved','rejected')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz not null default now(),
  draft_profile jsonb not null default '{}'::jsonb,
  draft_scores jsonb not null default '[]'::jsonb,
  -- Durable reconciliation identity: reject clears brands.ai_profile_draft
  -- (and the draft it came from) on commit, so a resume failure after a
  -- committed decision has nowhere left to recover the workflow run id from
  -- except this audit row. Nullable: extracted best-effort from the draft's
  -- _workflow_run_id at decision time, absent for any row written before
  -- this column existed.
  workflow_run_id text,
  created_at timestamptz not null default now()
);

alter table public.brand_profile_approvals enable row level security;

create index if not exists brand_profile_approvals_brand_id_idx
  on public.brand_profile_approvals (brand_id);

drop policy if exists brand_profile_approvals_select_org
  on public.brand_profile_approvals;

create policy brand_profile_approvals_select_org
  on public.brand_profile_approvals
  for select
  to authenticated
  using (public.is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- 3. Approve RPC: promote the EXACT reviewed artifact atomically & idempotently
-- ---------------------------------------------------------------------------
create or replace function public.approve_brand_intelligence_draft(
  p_brand_id uuid,
  p_expected_draft_hash text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_draft jsonb;
  v_hash text;
  v_score jsonb;
  v_version integer;
  v_approved bool;
  v_decision_code text;
  v_workflow_run_id text;
begin
  -- authorize caller
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED');
  end if;

  select org_id into v_org_id
  from public.brands
  where id = p_brand_id;

  if v_org_id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if not public.is_org_editor_or_above(v_org_id) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  -- lock the brand row and read the CURRENT stored artifact
  select ai_profile_draft, (approved_profile_at is not null)
    into v_draft, v_approved
  from public.brands
  where id = p_brand_id
  for update;

  if v_draft is null or v_draft = '{}'::jsonb then
    return jsonb_build_object('ok', false, 'code', 'NO_DRAFT');
  end if;

  -- optimistic concurrency: reviewed identity must equal current stored artifact
  v_hash := encode(extensions.digest(v_draft::text, 'sha256'), 'hex');
  if v_hash is distinct from p_expected_draft_hash then
    return jsonb_build_object('ok', false, 'code', 'STALE_DRAFT');
  end if;

  -- idempotent replay: already approved for the same reviewed artifact hash
  if v_approved and exists (
    select 1 from public.brand_profile_approvals a
    where a.brand_id = p_brand_id and a.draft_hash = p_expected_draft_hash and a.decision = 'approved'
  ) then
    return jsonb_build_object('ok', true, 'code', 'ALREADY_APPROVED');
  end if;

  -- Trusted workflow-run binding, enforced HERE rather than trusting the
  -- caller: _workflow_run_id lives inside ai_profile_draft, a column any
  -- authenticated org member can write via ordinary brands RLS. This RPC is
  -- itself directly callable by any authenticated editor/owner via
  -- PostgREST, not only through the Mastra tool's own brand_crawls check —
  -- so a forged/missing run id must fail closed inside the privileged
  -- boundary, not rely solely on an application-layer precheck.
  -- brand_crawls has no authenticated write policy (service-role only), so
  -- a matching row is a trustworthy brand<->run binding.
  v_workflow_run_id := nullif(v_draft->>'_workflow_run_id', '');
  if v_workflow_run_id is null or not exists (
    select 1 from public.brand_crawls c
    where c.brand_id = p_brand_id and c.workflow_id = v_workflow_run_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'INVALID_DRAFT');
  end if;

  v_version := coalesce(
    (select max(a.profile_version) from public.brand_profile_approvals a where a.brand_id = p_brand_id),
    0
  ) + 1;

  -- validate embedded score rows BEFORE mutating anything; malformed rows must
  -- return a clean code, never raise inside the SECURITY DEFINER function
  for v_score in select * from jsonb_array_elements(coalesce(v_draft->'_draft_scores', '[]'::jsonb))
  loop
    if v_score->>'score_type' is null or v_score->>'score_type' = '' or v_score->>'score' is null then
      return jsonb_build_object('ok', false, 'code', 'INVALID_DRAFT');
    end if;
    begin
      if (v_score->>'score')::numeric < 0 or (v_score->>'score')::numeric > 100 then
        return jsonb_build_object('ok', false, 'code', 'INVALID_DRAFT');
      end if;
    exception when others then
      return jsonb_build_object('ok', false, 'code', 'INVALID_DRAFT');
    end;
  end loop;

  -- promote the exact server-stored artifact into approved truth.
  -- hash + audit keep the complete reviewed draft; the promoted ai_profile
  -- strips internal staging metadata (_draft_scores/_lifecycle/_workflow_run_id)
  -- so approved truth is a clean business object. _draft_scores is promoted
  -- separately into brand_scores below.
  --
  -- ai_profile_draft is cleared here too (mirroring reject below): one exact
  -- draft_hash must have exactly one final human decision. Leaving the draft
  -- in place after approval would let the SAME hash later be rejected,
  -- producing a brand_profile_approvals audit trail with contradictory
  -- approved+rejected rows for one artifact. Clearing it makes a later
  -- reject of this hash fail closed with NO_DRAFT, the same protection
  -- reject already relies on for blocking a subsequent approve.
  update public.brands
    set ai_profile = v_draft - '_draft_scores' - '_lifecycle' - '_workflow_run_id',
        ai_profile_draft = null,
        approved_profile_at = now(),
        intake_status = 'ready',
        approved_profile_version = v_version,
        approved_by = auth.uid(),
        approved_draft_hash = p_expected_draft_hash,
        updated_at = now()
  where id = p_brand_id;

  -- replace score rows (brand_scores has no unique constraint; delete+insert in same tx)
  delete from public.brand_scores where brand_id = p_brand_id;

  for v_score in select * from jsonb_array_elements(coalesce(v_draft->'_draft_scores', '[]'::jsonb))
  loop
    insert into public.brand_scores (brand_id, score_type, score, details, score_version, source)
    values (
      p_brand_id,
      v_score->>'score_type',
      (v_score->>'score')::numeric,
      coalesce(v_score->'details', '{}'::jsonb),
      coalesce((v_score->>'score_version')::int, 1),
      coalesce(v_score->>'source', 'mastra_agent')
    );
  end loop;

  -- audit row: persist the VERIFIED v_workflow_run_id (proven against
  -- brand_crawls above), never the raw unvalidated draft field, so a later
  -- resume-recovery lookup can trust what it reads back.
  insert into public.brand_profile_approvals
    (brand_id, org_id, draft_hash, profile_version, decision, decided_by, draft_profile, draft_scores, workflow_run_id)
  values
    (p_brand_id, v_org_id, p_expected_draft_hash, v_version, 'approved', auth.uid(), v_draft, coalesce(v_draft->'_draft_scores', '[]'::jsonb), v_workflow_run_id);

  return jsonb_build_object('ok', true, 'code', 'APPROVED', 'profile_version', v_version, 'draft_hash', p_expected_draft_hash);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Reject RPC: discard the exact reviewed draft, never touch approved truth
-- ---------------------------------------------------------------------------
create or replace function public.reject_brand_intelligence_draft(
  p_brand_id uuid,
  p_expected_draft_hash text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_draft jsonb;
  v_hash text;
  v_approved bool;
  v_version integer;
  v_new_status public.brand_intake_status;
  v_workflow_run_id text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED');
  end if;

  select org_id into v_org_id
  from public.brands
  where id = p_brand_id;

  if v_org_id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if not public.is_org_editor_or_above(v_org_id) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select ai_profile_draft, (approved_profile_at is not null)
    into v_draft, v_approved
  from public.brands
  where id = p_brand_id
  for update;

  if v_draft is null or v_draft = '{}'::jsonb then
    return jsonb_build_object('ok', false, 'code', 'NO_DRAFT');
  end if;

  v_hash := encode(extensions.digest(v_draft::text, 'sha256'), 'hex');
  if v_hash is distinct from p_expected_draft_hash then
    return jsonb_build_object('ok', false, 'code', 'STALE_DRAFT');
  end if;

  -- idempotent replay: already rejected for this exact reviewed artifact.
  -- NOTE: after a successful reject the draft is cleared, so a plain replay
  -- returns NO_DRAFT (non-destructive). ALREADY_REJECTED is only reachable if
  -- a new draft with byte-identical content is created afterwards.
  if exists (
    select 1 from public.brand_profile_approvals a
    where a.brand_id = p_brand_id and a.draft_hash = p_expected_draft_hash and a.decision = 'rejected'
  ) then
    return jsonb_build_object('ok', true, 'code', 'ALREADY_REJECTED');
  end if;

  -- Trusted workflow-run binding, enforced HERE — see approve_brand_intelligence_draft
  -- for why this cannot rely solely on the Mastra tool's own brand_crawls check.
  v_workflow_run_id := nullif(v_draft->>'_workflow_run_id', '');
  if v_workflow_run_id is null or not exists (
    select 1 from public.brand_crawls c
    where c.brand_id = p_brand_id and c.workflow_id = v_workflow_run_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'INVALID_DRAFT');
  end if;

  v_version := coalesce(
    (select max(a.profile_version) from public.brand_profile_approvals a where a.brand_id = p_brand_id),
    0
  ) + 1;

  -- prior approved truth remains untouched if present
  v_new_status := case when v_approved then 'ready'::public.brand_intake_status else 'brand_created'::public.brand_intake_status end;

  update public.brands
    set ai_profile_draft = null,
        intake_status = v_new_status,
        updated_at = now()
  where id = p_brand_id;

  insert into public.brand_profile_approvals
    (brand_id, org_id, draft_hash, profile_version, decision, decided_by, draft_profile, draft_scores, workflow_run_id)
  values
    (p_brand_id, v_org_id, p_expected_draft_hash, v_version, 'rejected', auth.uid(), v_draft, coalesce(v_draft->'_draft_scores', '[]'::jsonb), v_workflow_run_id);

  return jsonb_build_object('ok', true, 'code', 'REJECTED', 'profile_version', v_version, 'draft_hash', p_expected_draft_hash);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Grants: revoke broad access, grant execute to authenticated only.
-- No caller in this codebase invokes these two RPCs via service_role (only
-- the user-scoped approveDraft tool does, with the operator's own JWT) and
-- both bodies fail closed to UNAUTHENTICATED when auth.uid() is null anyway.
-- Omitting the service_role grant tightens the human-approval boundary at
-- the DB layer instead of relying solely on that in-function check — a
-- future service-role caller must be deliberately re-granted, not silently
-- inherit the ability to call these.
--
-- service_role must be revoked explicitly, not just omitted from the grant
-- list below: a platform default ACL (pg_default_acl, defaclrole
-- supabase_admin/postgres, defaclobjtype 'f') auto-grants EXECUTE to
-- service_role on every newly created function in public, independent of
-- these statements. Confirmed locally — before this line, service_role
-- still held EXECUTE despite never being named in the grant.
-- ---------------------------------------------------------------------------
revoke all on function public.approve_brand_intelligence_draft(uuid, text) from public, anon, service_role;
revoke all on function public.reject_brand_intelligence_draft(uuid, text) from public, anon, service_role;
grant execute on function public.approve_brand_intelligence_draft(uuid, text) to authenticated;
grant execute on function public.reject_brand_intelligence_draft(uuid, text) to authenticated;

revoke all on table public.brand_profile_approvals from anon;
grant select on table public.brand_profile_approvals to authenticated, service_role;

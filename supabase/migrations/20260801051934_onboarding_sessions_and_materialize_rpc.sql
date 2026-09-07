-- IPI-832 · ONB2-DB-001 — onboarding_sessions + materialize_onboarding_session
--
-- Draft wizard state (status draft|materialized only — not brands.intake_status) plus one
-- SECURITY INVOKER RPC that turns a draft into exactly one org + brand.
--
-- Pre-generate UUIDs (no INSERT … RETURNING) — same trap proven in IPI-809.
-- Unique (user_id, idempotency_key) is the duplicate-prevention primitive; app uses a
-- stable browser idempotency_key (localStorage / in-memory) so get-or-create hits one draft.
--
-- Clients may write draft columns only. Outcome columns (status, organization_id, brand_id)
-- flip only when the RPC sets transaction-local app.onboarding_materializing=on.
--
-- Rollback:
--   drop function public.materialize_onboarding_session(text, text, text);
--   drop trigger if exists onboarding_sessions_set_updated_at on public.onboarding_sessions;
--   drop table public.onboarding_sessions;

create table public.onboarding_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  status          text not null default 'draft'
                    check (status in ('draft', 'materialized')),
  current_screen  smallint not null default 1
                    check (current_screen between 1 and 13),
  draft_answers   jsonb not null default '{}'::jsonb,
  -- SET NULL so owner DELETE on brands/organizations is not blocked by session history.
  organization_id uuid references public.organizations(id) on delete set null,
  brand_id        uuid references public.brands(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- THE duplicate-prevention primitive. SELECT ... FOR UPDATE is not: Postgres
  -- locks only rows already visible to the snapshot, so two transactions that
  -- both find nothing both insert. Drop this and the RPC quietly stops being
  -- idempotent, with no error anywhere.
  constraint onboarding_sessions_user_key unique (user_id, idempotency_key)
);

create trigger onboarding_sessions_set_updated_at
  before update on public.onboarding_sessions
  for each row execute function public.set_updated_at();

alter table public.onboarding_sessions enable row level security;

-- Ownership preserved; draft-shaped writes only. RPC sets app.onboarding_materializing
-- for the single UPDATE that writes outcome columns (keeps SECURITY INVOKER for org/brand).
create policy "onboarding_sessions_select_own" on public.onboarding_sessions
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "onboarding_sessions_insert_own" on public.onboarding_sessions
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'draft'
    and organization_id is null
    and brand_id is null
  );

create policy "onboarding_sessions_update_own" on public.onboarding_sessions
  for update to authenticated
  using (
    (select auth.uid()) = user_id
    and (
      status = 'draft'
      or current_setting('app.onboarding_materializing', true) = 'on'
    )
  )
  with check (
    (select auth.uid()) = user_id
    and (
      (status = 'draft' and organization_id is null and brand_id is null)
      or current_setting('app.onboarding_materializing', true) = 'on'
    )
  );

create policy "onboarding_sessions_delete_own" on public.onboarding_sessions
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.materialize_onboarding_session(
  p_idempotency_key text,
  p_brand_name      text,
  p_brand_url       text
) returns jsonb
language plpgsql
security invoker
set search_path to 'public'
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_session  public.onboarding_sessions%rowtype;
  v_org_id   uuid;
  v_brand_id uuid;
  v_slug     text;
begin
  if v_uid is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select * into v_session
    from public.onboarding_sessions
   where user_id = v_uid and idempotency_key = p_idempotency_key
   for update;

  if not found then
    raise exception 'session not found' using errcode = 'P0002';
  end if;

  -- Replay path: the second concurrent caller lands here after the first commits.
  if v_session.status = 'materialized' then
    return jsonb_build_object('organization_id', v_session.organization_id,
                              'brand_id',        v_session.brand_id);
  end if;

  -- Pre-generated, NOT from INSERT ... RETURNING. RETURNING is projected against
  -- the SELECT policy before the AFTER INSERT membership trigger fires — that is
  -- the exact 42501 failure proven in IPI-809.
  v_org_id   := gen_random_uuid();
  v_brand_id := gen_random_uuid();
  v_slug     := left(regexp_replace(lower(p_brand_name), '[^a-z0-9]+', '-', 'g'), 40)
                || '-' || left(v_org_id::text, 8);

  insert into public.organizations (id, name, slug, owner_id, type)
  values (v_org_id, p_brand_name, v_slug, v_uid, 'brand');
  -- organizations_auto_add_owner (AFTER INSERT) has now written org_members,
  -- so is_org_member(v_org_id) is true for the next statement.

  insert into public.brands (id, name, org_id, user_id, brand_url)
  values (v_brand_id, p_brand_name, v_org_id, v_uid, p_brand_url);

  -- Transaction-local; lets UPDATE with check accept outcome columns. Not exposed via PostgREST.
  perform set_config('app.onboarding_materializing', 'on', true);

  update public.onboarding_sessions
     set status = 'materialized',
         organization_id = v_org_id,
         brand_id = v_brand_id
   where id = v_session.id;

  return jsonb_build_object('organization_id', v_org_id, 'brand_id', v_brand_id);
end $$;

revoke execute on function public.materialize_onboarding_session(text, text, text) from public, anon;
grant  execute on function public.materialize_onboarding_session(text, text, text) to authenticated;

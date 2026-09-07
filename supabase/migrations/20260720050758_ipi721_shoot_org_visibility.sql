-- IPI-721 SHOOT-REG-001 — restore shoot visibility for non-owner org members
--
-- Root cause (confirmed live, 2026-07-20): every shoot-domain read path — the
-- public.shoot_portfolio_view (security_invoker=true), the six durable
-- shoot.* tables' SELECT policies, and the public.get_shoot_detail(uuid) RPC
-- — all gate on personal brand ownership (`brands.user_id = auth.uid()`)
-- instead of organization membership. In a real multi-user org, an operator
-- who creates a shoot for a brand they don't personally "own" the brands row
-- for cannot see the shoot they just created. Repro: qa@ipix.test (editor,
-- org 00000000-0000-0000-0000-000000000001) created shoot 2f6d43ba-8ae9-4f44-
-- 914e-44e744f8a152 for Nike (brand owned by alice@acme.com, same org) —
-- 0 rows from the view, "not_found" from the RPC, despite created_by being
-- the QA user's own id.
--
-- Fix: replace the ownership predicate everywhere with public.is_org_member
-- (org_id) — the same convention used by CRM (see is_org_editor_or_above
-- precedent, 20260712091149_crm_deals_convert_hardening.sql) and everywhere
-- else org-scoped access is checked in this app.
--
-- No legacy-brand null-org_id fallback is needed: brands.org_id is a NOT
-- NULL FK to organizations (brands_org_id_fkey), confirmed 0 of 4063 brand
-- rows have a null org_id, and every brand owner is already enrolled as an
-- org_members row for their brand's org — is_org_member(b.org_id) alone is
-- sufficient and correct.
--
-- Out of scope (explicitly untouched): shoot.shoot_intake_drafts stays
-- submitter-only (personal HITL workspace, not a shared view). Read-only
-- exposure widens (owner-only -> org-member), no write policies exist on
-- these tables today (writes are service-role only via edge functions /
-- commit_shoot_draft RPC) so this migration does not touch any write path.
--
-- Rollback: re-apply the six `create policy ... using (... brands.user_id =
-- (select auth.uid()) ...)` statements from 20260622120000_shoot_core_schema.sql,
-- `create or replace view public.shoot_portfolio_view` from
-- 20260626000007_shoot_portfolio_view.sql, and restore the prior
-- get_shoot_detail body (`and b.user_id = auth.uid()`) from
-- 20260707132407_get_shoot_detail_asset_resource_type.sql.

-- ---------------------------------------------------------------------------
-- 1. Durable table SELECT policies — drop + recreate (no parallel policies;
--    Postgres combines multiple permissive policies with OR, so leaving the
--    old owner-only policy in place would silently preserve the same gap).
-- ---------------------------------------------------------------------------

drop policy if exists shoots_select_owner on shoot.shoots;
create policy shoots_select_owner on shoot.shoots
  for select to authenticated
  using (
    brand_id in (
      select id from public.brands where public.is_org_member(org_id)
    )
  );

drop policy if exists shoot_assets_select_owner on shoot.shoot_assets;
create policy shoot_assets_select_owner on shoot.shoot_assets
  for select to authenticated
  using (
    shoot_id in (
      select id from shoot.shoots
      where brand_id in (
        select id from public.brands where public.is_org_member(org_id)
      )
    )
  );

drop policy if exists shoot_deliverables_select_owner on shoot.shoot_deliverables;
create policy shoot_deliverables_select_owner on shoot.shoot_deliverables
  for select to authenticated
  using (
    shoot_id in (
      select id from shoot.shoots
      where brand_id in (
        select id from public.brands where public.is_org_member(org_id)
      )
    )
  );

drop policy if exists shot_list_select_owner on shoot.shot_list;
create policy shot_list_select_owner on shoot.shot_list
  for select to authenticated
  using (
    shoot_id in (
      select id from shoot.shoots
      where brand_id in (
        select id from public.brands where public.is_org_member(org_id)
      )
    )
  );

drop policy if exists shoot_crew_select_owner on shoot.shoot_crew;
create policy shoot_crew_select_owner on shoot.shoot_crew
  for select to authenticated
  using (
    shoot_id in (
      select id from shoot.shoots
      where brand_id in (
        select id from public.brands where public.is_org_member(org_id)
      )
    )
  );

drop policy if exists sdl_select_owner on shoot.shot_deliverable_links;
create policy sdl_select_owner on shoot.shot_deliverable_links
  for select to authenticated
  using (
    deliverable_id in (
      select d.id from shoot.shoot_deliverables d
      where d.shoot_id in (
        select id from shoot.shoots
        where brand_id in (
          select id from public.brands where public.is_org_member(org_id)
        )
      )
    )
  );

-- shoot.shoot_intake_drafts is intentionally left untouched: submitted_by = auth.uid() only.

-- ---------------------------------------------------------------------------
-- 2. public.shoot_portfolio_view — same predicate change, security_invoker
--    stays true (the view itself doesn't need SECURITY DEFINER; RLS on the
--    underlying tables plus this predicate is enough now that both agree).
-- ---------------------------------------------------------------------------

create or replace view public.shoot_portfolio_view
with (security_invoker = true) as
select
  s.id,
  s.name,
  s.type::text as type,
  s.status::text as status,
  s.dna_score,
  s.target_channels::text[] as target_channels,
  s.estimated_budget,
  s.start_date,
  s.end_date,
  s.location,
  s.updated_at,
  s.brand_id,
  s.created_by,
  (select count(*)::integer from shoot.shot_list sl where sl.shoot_id = s.id) as shot_count,
  (select count(*)::integer from shoot.shoot_assets sa where sa.shoot_id = s.id) as asset_count,
  case
    when s.mood_board_urls is not null and cardinality(s.mood_board_urls) > 0
    then s.mood_board_urls[1]
    else null
  end as cover_url
from shoot.shoots s
join public.brands b on b.id = s.brand_id
where public.is_org_member(b.org_id);

-- Grants were broader than the original 20260626000007 migration intended
-- (anon had SELECT + write privileges live, presumably from a later blanket
-- grant script) — reset to authenticated SELECT only, matching every other
-- app-facing view in this schema.
revoke all on public.shoot_portfolio_view from public, anon, authenticated;
grant select on public.shoot_portfolio_view to authenticated;

-- ---------------------------------------------------------------------------
-- 3. public.get_shoot_detail(uuid) — same predicate change. Body otherwise
--    unchanged from the live definition (20260707132407 revision).
-- ---------------------------------------------------------------------------

create or replace function public.get_shoot_detail(p_shoot_id uuid)
 returns json
 language plpgsql
 security definer
 set search_path to 'shoot', 'public'
as $function$
declare
  v_result json;
  v_brand_id uuid;
begin
  if auth.uid() is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select s.brand_id
  into v_brand_id
  from shoot.shoots s
  inner join public.brands b on b.id = s.brand_id
  where s.id = p_shoot_id
    and public.is_org_member(b.org_id);

  if v_brand_id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select json_build_object(
    'shoot', (
      select json_build_object(
        'id', s.id,
        'name', s.name,
        'status', s.status::text,
        'brief', s.brief,
        'target_channels', coalesce(s.target_channels::text[], array[]::text[]),
        'estimated_budget', s.estimated_budget,
        'actual_cost', s.actual_cost,
        'currency', s.currency,
        'budget_breakdown', s.budget_breakdown,
        'start_date', s.start_date,
        'end_date', s.end_date,
        'location', s.location,
        'dna_score', s.dna_score,
        'mood_board_urls', coalesce(s.mood_board_urls, array[]::text[]),
        'cover_url', case
          when s.mood_board_urls is not null and cardinality(s.mood_board_urls) > 0
          then s.mood_board_urls[1]
          else null
        end,
        'created_at', s.created_at,
        'updated_at', s.updated_at,
        'brand_id', s.brand_id
      )
      from shoot.shoots s
      where s.id = p_shoot_id
    ),
    'brand', (
      select json_build_object('id', b.id, 'name', b.name)
      from public.brands b
      where b.id = v_brand_id
    ),
    'deliverables', coalesce((
      select json_agg(json_build_object(
        'id', d.id,
        'channel', d.channel::text,
        'format', d.format,
        'quantity', d.quantity,
        'status', d.status
      ) order by d.channel)
      from shoot.shoot_deliverables d
      where d.shoot_id = p_shoot_id
    ), '[]'::json),
    'shots', coalesce((
      select json_agg(json_build_object(
        'id', sl.id,
        'shot_number', sl."order",
        'description', sl.description,
        'style_notes', sl.style_notes,
        'status', sl.status::text
      ) order by sl."order")
      from shoot.shot_list sl
      where sl.shoot_id = p_shoot_id
    ), '[]'::json),
    'assets', coalesce((
      select json_agg(json_build_object(
        'id', a.id,
        'url', a.url,
        'cloudinary_id', a.cloudinary_id,
        'format', a.format,
        'resource_type', a.resource_type,
        'width', a.width,
        'height', a.height,
        'dna_score', a.dna_score,
        'status', a.status::text,
        'created_at', a.created_at
      ) order by a.created_at desc)
      from shoot.shoot_assets a
      where a.shoot_id = p_shoot_id
    ), '[]'::json),
    'crew', coalesce((
      select json_agg(json_build_object(
        'id', c.id,
        'role', c.role::text,
        'confirmed', c.confirmed,
        'notes', c.notes,
        'internal_contact_id', c.internal_contact_id,
        'marketplace_vendor_id', c.marketplace_vendor_id
      ) order by c.role)
      from shoot.shoot_crew c
      where c.shoot_id = p_shoot_id
    ), '[]'::json),
    'approvals', coalesce((
      select json_agg(json_build_object(
        'id', d.id,
        'status', d.status,
        'created_at', d.created_at,
        'approved_at', d.approved_at,
        'rejected_at', d.rejected_at,
        'agent_run_id', d.agent_run_id
      ) order by d.created_at desc)
      from shoot.shoot_intake_drafts d
      where d.submitted_by = auth.uid()
        and d.brand_id = v_brand_id
        and (
          d.source_context->>'shoot_id' = p_shoot_id::text
          or d.draft_shoot->>'id' = p_shoot_id::text
        )
    ), '[]'::json),
    'activity', coalesce((
      select json_agg(json_build_object(
        'id', sub.id,
        'agent_name', sub.agent_name,
        'created_at', sub.created_at,
        'model', sub.model
      ) order by sub.created_at desc)
      from (
        select l.id, l.agent_name, l.created_at, l.model
        from public.ai_agent_logs l
        where l.brand_id = v_brand_id
          and (
            l.input->>'shoot_id' = p_shoot_id::text
            or l.output->>'shoot_id' = p_shoot_id::text
          )
        order by l.created_at desc
        limit 50
      ) sub
    ), '[]'::json)
  )
  into v_result;

  return v_result;
end;
$function$;

comment on function public.get_shoot_detail(uuid) is
  'IPI-721 — org-membership authorization (public.is_org_member), replacing the prior personal-brand-ownership check. Approvals sub-object stays submitter-scoped (shoot_intake_drafts is a personal HITL workspace, unaffected by this ticket).';

revoke all on function public.get_shoot_detail(uuid) from public, anon, authenticated;
grant execute on function public.get_shoot_detail(uuid) to authenticated;

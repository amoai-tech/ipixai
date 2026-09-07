-- ============================================================================
-- Migration: CLD-DNA-001 / IPI-959 — DNA single-source: keep assets, drop dead copies
-- ----------------------------------------------------------------------------
-- Purpose:   `assets` is the only table ever written or read for DNA state
--            (audit-asset-dna/handler.ts:357-366 writes assets only). The copies
--            on cloudinary_assets and shoot.shoot_assets are 100% empty on the
--            remote (verified 2026-08-09: 0 non-null / 10 rows; 0 rows in
--            shoot.shoot_assets). Drop the dead copies + their machinery.
-- Safety:    No app code reads the dropped columns. The two RPCs below keep
--            their JSON contract by emitting dna_score as NULL for shoot rows
--            (shoot.shoot_assets is empty — no behavior change). The shoot-level
--            rollup column shoot.shoots.dna_score is KEPT (read by app via
--            shoot_portfolio_view + get_shoot_detail); it becomes static until
--            a follow-up app PR removes the UI reads and a second migration
--            drops it.
-- Verified:  tasks/cloudinary/audit/aug9-cloudinary-audit.md (addendum)
-- Rollback:  see bottom comment block.
-- ============================================================================

begin;

-- ---------- 1. cloudinary_assets — drop dead DNA columns + guard ----------
alter table public.cloudinary_assets
  drop constraint if exists cloudinary_assets_dna_status_check;
alter table public.cloudinary_assets
  drop column if exists dna_status;
alter table public.cloudinary_assets
  drop column if exists dna_score;

-- ---------- 2. shoot rollup machinery — drop trigger + function -----------
-- The trigger maintained shoot.shoots.dna_score from shoot.shoot_assets rows.
-- shoot.shoot_assets has 0 rows; the rollup is vestigial.
drop trigger if exists trg_recalc_shoot_dna_score on shoot.shoot_assets;
drop function if exists shoot.recalc_shoot_dna_score();

-- ---------- 3. RPC contract preservation (no reference to dropped cols) ---
-- get_shoot_detail: canonical body = IPI-721 org-aware version
-- (20260720050758); shoot-asset dna_score now constant NULL (column dropped).
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
        'dna_score', null::integer,  -- CLD-DNA-001: column dropped; key kept as NULL to preserve JSON contract
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

-- get_brand_assets (latest body from 20260703240000_shoot_data_contract_nits):
-- shoot-branch dna_score now constant NULL (column dropped); platform branch
-- still reads the canonical public.assets.dna_score / dna_status.
create or replace function public.get_brand_assets(
  p_brand_id uuid,
  p_shoot_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = public, shoot
as $$
declare
  v_result json;
begin
  if auth.uid() is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.brands b
    where b.id = p_brand_id
      and (
        (b.org_id is null and b.user_id = auth.uid())
        or (b.org_id is not null and public.is_org_member(b.org_id))
      )
  ) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if p_shoot_id is not null and not exists (
    select 1 from shoot.shoots s
    where s.id = p_shoot_id and s.brand_id = p_brand_id
  ) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select coalesce(json_agg(capped.row order by capped.sort_at desc), '[]'::json)
  into v_result
  from (
    select unified.row, unified.sort_at
    from (
      select
        json_build_object(
          'id', a.id,
          'source', 'platform',
          'shoot_id', a.shoot_id,
          'url', a.url,
          'thumbnail_url', a.thumbnail_url,
          'dna_score', a.dna_score,
          'dna_status', a.dna_status,
          'status', a.status,
          'created_at', a.created_at
        ) as row,
        a.created_at as sort_at
      from public.assets a
      where a.brand_id = p_brand_id
        and (p_shoot_id is null or a.shoot_id = p_shoot_id)

      union all

      select
        json_build_object(
          'id', sa.id,
          'source', 'shoot',
          'shoot_id', sa.shoot_id,
          'url', sa.url,
          'thumbnail_url', null,
          -- CLD-DNA-001: column dropped; key kept as NULL to preserve JSON contract
          'dna_score', null::integer,
          'dna_status', null,
          'status', sa.status::text,
          'created_at', sa.created_at
        ),
        sa.created_at
      from shoot.shoot_assets sa
      inner join shoot.shoots s on s.id = sa.shoot_id
      where s.brand_id = p_brand_id
        and (p_shoot_id is null or sa.shoot_id = p_shoot_id)
    ) unified
    order by unified.sort_at desc
    limit 100
  ) capped;

  return v_result;
end;
$$;

revoke all on function public.get_brand_assets(uuid, uuid) from public;
grant execute on function public.get_brand_assets(uuid, uuid) to authenticated;

-- ---------- 4. shoot.shoot_assets — drop dead DNA columns + index ---------
drop index if exists shoot.idx_shoot_assets_dna_score;
alter table shoot.shoot_assets
  drop column if exists dna_score;
alter table shoot.shoot_assets
  drop column if exists dna_scores;
alter table shoot.shoot_assets
  drop column if exists dna_flags;
alter table shoot.shoot_assets
  drop column if exists dna_suggestions;

commit;

-- ============================================================================
-- ROLLBACK (manual — run as a separate down migration if needed)
-- ----------------------------------------------------------------------------
-- alter table public.cloudinary_assets add column dna_status text, add column dna_score numeric;
-- alter table public.cloudinary_assets add constraint cloudinary_assets_dna_status_check
--   check (dna_status is null or dna_status in ('approved', 'review', 'blocked'));
-- alter table shoot.shoot_assets add column dna_score integer check (dna_score >= 0 and dna_score <= 100),
--   add column dna_scores jsonb, add column dna_flags jsonb, add column dna_suggestions jsonb;
-- create index idx_shoot_assets_dna_score on shoot.shoot_assets(dna_score);
-- -- restore shoot.recalc_shoot_dna_score() + trg_recalc_shoot_dna_score and the
-- -- two RPC bodies from 20260707132407 / 20260703240000.
-- ============================================================================

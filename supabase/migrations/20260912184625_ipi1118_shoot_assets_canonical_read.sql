-- IPI-1118 · SHOOT-ASSETS-001 — Attach Uploaded Assets to the Correct Saved Shoot
--
-- Purpose: Replace the stale `get_shoot_detail` assets subquery (which reads
-- from empty `shoot.shoot_assets`) with the canonical V2 asset relationship:
-- `public.assets.v2_shoot_id → shoot.shoots.id`.
--
-- The webhook (IPI-1111) already persists trusted `v2_shoot_id` into
-- `public.assets`. Production has 4 valid linked V2 assets. `shoot.shoot_assets`
-- has 0 rows. This migration fixes the read path only — no new tables, no
-- new attachment API, no Cloudinary search-as-database.
--
-- Authorization: preserves IPI-721 org-membership model via `public.is_org_member(b.org_id)`.
-- Security: preserves existing SECURITY DEFINER, search_path, grants, and
-- org/brand authorization.
--
-- Field mapping (preserves existing ShootDetail.assets contract):
--   id              ← public.assets.id
--   url             ← public.assets.url (metadata only; not auth boundary)
--   cloudinary_id   ← public.cloudinary_assets.public_id (fallback: assets.cloudinary_public_id)
--   format          ← public.cloudinary_assets.format
--   resource_type   ← public.cloudinary_assets.resource_type
--   width           ← coalesce(public.cloudinary_assets.width, public.assets.width)
--   height          ← coalesce(public.cloudinary_assets.height, public.assets.height)
--   dna_score       ← public.assets.dna_score
--   status          ← public.assets.status::text
--   created_at      ← public.assets.created_at

create or replace function public.get_shoot_detail(p_shoot_id uuid)
returns json
language plpgsql
security definer
set search_path = shoot, public
as $$
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
        'cloudinary_id', coalesce(ca.public_id, a.cloudinary_public_id),
        'format', ca.format,
        'resource_type', ca.resource_type,
        'width', coalesce(ca.width, a.width),
        'height', coalesce(ca.height, a.height),
        'dna_score', a.dna_score,
        'status', a.status::text,
        'created_at', a.created_at
      ) order by a.created_at desc)
      from public.assets a
      left join public.cloudinary_assets ca on ca.asset_id = a.id
      where a.v2_shoot_id = p_shoot_id
        and a.brand_id = v_brand_id
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
$$;

comment on function public.get_shoot_detail(uuid) is
  'IPI-1118 — canonical V2 asset read via public.assets.v2_shoot_id. IPI-721 org-membership authorization (public.is_org_member) preserved.';

revoke all on function public.get_shoot_detail(uuid) from public, anon, authenticated;
grant execute on function public.get_shoot_detail(uuid) to authenticated;
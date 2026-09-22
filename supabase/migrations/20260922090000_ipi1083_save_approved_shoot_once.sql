-- IPI-1083 · SHOOT-SAVE-001 — persist one exact approved ShootPlan once.
-- Browser authority is intentionally one UUID: p_approval_id.

alter table shoot.shoots
  add column if not exists approval_id uuid references shoot.shoot_plan_approvals(id) on delete restrict,
  add column if not exists approval_revision integer,
  add column if not exists approval_plan_hash text,
  add column if not exists approved_plan jsonb,
  add column if not exists planned_shoot_type text;

alter table shoot.shoots
  drop constraint if exists shoots_approval_provenance_complete,
  add constraint shoots_approval_provenance_complete check (
    (approval_id is null and approval_revision is null and approval_plan_hash is null and approved_plan is null)
    or
    (approval_id is not null and approval_revision is not null and approval_plan_hash is not null and approved_plan is not null)
  );

alter table shoot.shoots
  drop constraint if exists shoots_approval_id_key,
  add constraint shoots_approval_id_key unique (approval_id);

alter table shoot.shot_list
  add column if not exists angle text,
  add column if not exists lighting text,
  add column if not exists reference_id uuid references shoot.shot_type_references(id) on delete restrict;

create or replace function public.save_approved_shoot(p_approval_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_approval shoot.shoot_plan_approvals%rowtype;
  v_plan jsonb;
  v_recomputed_hash text;
  v_existing_id uuid;
  v_shoot_id uuid;
  v_item jsonb;
  v_name text;
  v_brief text;
  v_planned_type text;
  v_storage_type shoot.shoot_type;
  v_location text;
  v_start_date date;
  v_end_date date;
  v_budget numeric;
  v_currency text;
  v_channels text[];
  v_deliverable_ids uuid[] := array[]::uuid[];
  v_deliverable_id uuid;
  v_shot_id uuid;
  v_index bigint;
  v_link text;
  v_link_index integer;
begin
  if v_actor is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED');
  end if;
  if p_approval_id is null then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;

  select * into v_approval
    from shoot.shoot_plan_approvals a
   where a.id = p_approval_id
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_approval.brand_id::text || ':' || v_approval.workflow_run_id, 0)
  );

  if not exists (
    select 1 from public.brands b
     where b.id = v_approval.brand_id
       and public.is_org_editor_or_above(b.org_id)
  ) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_recomputed_hash := encode(extensions.digest(v_approval.plan::text, 'sha256'), 'hex');
  if v_recomputed_hash is distinct from v_approval.plan_hash then
    return jsonb_build_object('ok', false, 'code', 'HASH_MISMATCH');
  end if;
  if v_approval.status is distinct from 'approved' then
    return jsonb_build_object('ok', false, 'code', 'NOT_APPROVED');
  end if;
  if exists (
    select 1 from shoot.shoot_plan_approvals newer
     where newer.workflow_run_id = v_approval.workflow_run_id
       and newer.revision > v_approval.revision
  ) then
    return jsonb_build_object('ok', false, 'code', 'SUPERSEDED_REVISION');
  end if;

  select s.id into v_existing_id
    from shoot.shoots s
   where s.approval_id = v_approval.id;
  if found then
    return jsonb_build_object('ok', true, 'shootId', v_existing_id, 'replayed', true);
  end if;

  v_plan := v_approval.plan;
  v_name := nullif(btrim(v_plan #>> '{shootName,value}'), '');
  if v_plan #>> '{shootName,status}' is distinct from 'confirmed' or v_name is null then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PLAN', 'detail', 'confirmed shootName is required');
  end if;
  v_brief := case when v_plan #>> '{brief,status}' = 'confirmed' then v_plan #>> '{brief,value}' else null end;
  v_location := case when v_plan #>> '{location,status}' = 'confirmed' then v_plan #>> '{location,value}' else null end;
  if v_plan #>> '{schedule,status}' = 'confirmed' then
    v_start_date := nullif(v_plan #>> '{schedule,value,startDate}', '')::date;
    v_end_date := nullif(v_plan #>> '{schedule,value,endDate}', '')::date;
  end if;

  v_planned_type := v_plan #>> '{shootTypeResult,shootType}';
  v_storage_type := case v_planned_type
    when 'ecommerce_pdp' then 'studio_ecommerce'::shoot.shoot_type
    when 'packshot' then 'studio_ecommerce'::shoot.shoot_type
    when 'editorial' then 'editorial_vogue'::shoot.shoot_type
    when 'campaign' then 'editorial_campaign'::shoot.shoot_type
    when 'lookbook' then 'editorial_campaign'::shoot.shoot_type
    when 'ugc_style' then 'video_motion'::shoot.shoot_type
    else null
  end;
  if v_storage_type is null then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PLAN', 'detail', 'recognized shoot type is required');
  end if;

  if jsonb_typeof(v_plan->'channels') <> 'array' or jsonb_array_length(v_plan->'channels') = 0 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PLAN', 'detail', 'channels are required');
  end if;
  select array_agg(value order by ordinality) into v_channels
  from jsonb_array_elements_text(v_plan->'channels') with ordinality as c(value, ordinality);

  if v_plan #>> '{budgetResult,status}' = 'ok' then
    v_budget := nullif(v_plan #>> '{budgetResult,total}', '')::numeric;
    v_currency := nullif(v_plan #>> '{budgetResult,currency}', '');
  end if;

  insert into shoot.shoots (
    brand_id, name, type, brief, target_channels, estimated_budget, currency,
    budget_breakdown, created_by, status, location, start_date, end_date,
    approval_id, approval_revision, approval_plan_hash, approved_plan, planned_shoot_type
  ) values (
    v_approval.brand_id, v_name, v_storage_type, v_brief, v_channels::shoot.channel[], v_budget,
    coalesce(v_currency, 'USD'), v_plan->'budgetResult', v_actor, 'planning', v_location,
    v_start_date, v_end_date, v_approval.id, v_approval.revision, v_approval.plan_hash,
    v_plan, v_planned_type
  ) returning id into v_shoot_id;

  if jsonb_typeof(v_plan #> '{deliverablesResult,deliverables}') = 'array' then
    for v_item, v_index in
      select value, ordinality
      from jsonb_array_elements(v_plan #> '{deliverablesResult,deliverables}') with ordinality
    loop
      insert into shoot.shoot_deliverables (
        shoot_id, channel, format, quantity, aspect_ratio, origin
      ) values (
        v_shoot_id,
        (v_item->>'channel')::shoot.channel,
        nullif(v_item->>'format', ''),
        (v_item->>'quantity')::integer,
        case
          when coalesce(v_item->>'format', '') ~ '^[0-9]+:[0-9]+'
          then split_part(v_item->>'format', ' ', 1)
          else null
        end,
        'ai_approved'
      ) returning id into v_deliverable_id;
      v_deliverable_ids := array_append(v_deliverable_ids, v_deliverable_id);
    end loop;
  end if;

  if jsonb_typeof(v_plan #> '{shotListResult,shots}') = 'array' then
    for v_item in select value from jsonb_array_elements(v_plan #> '{shotListResult,shots}')
    loop
      insert into shoot.shot_list (
        shoot_id, description, style_notes, "order", origin, status, angle, lighting, reference_id
      ) values (
        v_shoot_id,
        v_item->>'description',
        nullif(v_item->>'notes', ''),
        coalesce((v_item->>'shotNumber')::integer, 0),
        'ai_approved',
        'pending',
        nullif(v_item->>'angle', ''),
        nullif(v_item->>'lighting', ''),
        nullif(v_item->>'referenceId', '')::uuid
      ) returning id into v_shot_id;

      if jsonb_typeof(v_item->'deliverableIds') = 'array' then
        for v_link in select value from jsonb_array_elements_text(v_item->'deliverableIds')
        loop
          if v_link !~ '^d-[0-9]+$' then
            raise exception 'invalid deliverable link id' using errcode = '22023';
          end if;
          v_link_index := substring(v_link from 3)::integer + 1;
          if v_link_index < 1 or v_link_index > coalesce(array_length(v_deliverable_ids, 1), 0) then
            raise exception 'deliverable link index out of range' using errcode = '22023';
          end if;
          insert into shoot.shot_deliverable_links (shot_id, deliverable_id)
          values (v_shot_id, v_deliverable_ids[v_link_index])
          on conflict do nothing;
        end loop;
      end if;
    end loop;
  end if;

  return jsonb_build_object('ok', true, 'shootId', v_shoot_id, 'replayed', false);
exception
  when invalid_text_representation or data_exception or not_null_violation or check_violation or foreign_key_violation then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PLAN');
end;
$$;

comment on function public.save_approved_shoot(uuid) is
  'IPI-1083: authenticated owner/editor saves exactly one current approved ShootPlan. Input is only approval_id; actor, brand, plan, hash and revision are reloaded server-side.';

revoke all on function public.save_approved_shoot(uuid) from public, anon, service_role;
grant execute on function public.save_approved_shoot(uuid) to authenticated;


-- Extend the existing canonical read model; do not create a second Shoot reader.
create or replace function public.get_shoot_detail(p_shoot_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
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
        'brand_id', s.brand_id,
        'approval_id', s.approval_id,
        'approval_revision', s.approval_revision,
        'approval_plan_hash', s.approval_plan_hash,
        'approved_plan', s.approved_plan,
        'planned_shoot_type', s.planned_shoot_type
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
        'aspect_ratio', d.aspect_ratio,
        'origin', d.origin,
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
        'angle', sl.angle,
        'lighting', sl.lighting,
        'reference_id', sl.reference_id,
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
        'cloudinary_asset_id', ca.cloudinary_asset_id,
        'version', ca.version,
        'approval', ca.approval,
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
  'IPI-1083 — canonical V2 Shoot detail including exact approval provenance and trusted shot reference identity. Existing org-membership authorization preserved.';

revoke all on function public.get_shoot_detail(uuid) from public, anon, authenticated;
grant execute on function public.get_shoot_detail(uuid) to authenticated;

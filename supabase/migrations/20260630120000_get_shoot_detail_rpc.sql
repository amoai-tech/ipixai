-- IPI-209 · SHOOT-DETAIL-001 — hydrated shoot detail for operator UI
-- Rollback: drop function if exists public.get_shoot_detail(uuid);

create or replace function public.get_shoot_detail(p_shoot_id uuid)
returns json
language plpgsql
security definer
set search_path = shoot, public
as $$
declare
  v_result json;
begin
  if auth.uid() is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from shoot.shoots s
    inner join public.brands b on b.id = s.brand_id
    where s.id = p_shoot_id
      and b.user_id = auth.uid()
  ) then
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
        'budget_breakdown', s.budget_breakdown,
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
      inner join shoot.shoots s on s.brand_id = b.id
      where s.id = p_shoot_id
    ),
    'deliverables', coalesce((
      select json_agg(json_build_object(
        'id', d.id,
        'channel', d.channel::text,
        'format', d.format,
        'quantity', d.quantity
      ) order by d.channel)
      from shoot.shoot_deliverables d
      where d.shoot_id = p_shoot_id
    ), '[]'::json),
    'shots', coalesce((
      select json_agg(json_build_object(
        'id', sl.id,
        'shot_number', sl."order",
        'description', sl.description,
        'style_notes', sl.style_notes
      ) order by sl."order")
      from shoot.shot_list sl
      where sl.shoot_id = p_shoot_id
    ), '[]'::json)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_shoot_detail(uuid) from public;
grant execute on function public.get_shoot_detail(uuid) to authenticated;

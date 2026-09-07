-- IPI-248 enabler — unified read for public.assets + shoot.shoot_assets

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
          'dna_score', sa.dna_score,
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

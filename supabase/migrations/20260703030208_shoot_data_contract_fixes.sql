-- IPI-273 — extend shoot_portfolio_view (start_date, counts, cover_url)
-- Rollback: restore 20260626000007_shoot_portfolio_view.sql

drop view if exists public.shoot_portfolio_view;

create view public.shoot_portfolio_view
  with (security_invoker = true) as
select
  s.id,
  s.name,
  s.type::text              as type,
  s.status::text            as status,
  s.dna_score,
  s.target_channels::text[] as target_channels,
  s.estimated_budget,
  s.start_date,
  s.end_date,
  s.location,
  s.updated_at,
  s.brand_id,
  s.created_by,
  (
    select count(*)::integer
    from shoot.shot_list sl
    where sl.shoot_id = s.id
  ) as shot_count,
  (
    select count(*)::integer
    from shoot.shoot_assets sa
    where sa.shoot_id = s.id
  ) as asset_count,
  case
    when s.mood_board_urls is not null and cardinality(s.mood_board_urls) > 0
    then s.mood_board_urls[1]
    else null
  end as cover_url
from shoot.shoots s
inner join public.brands b on b.id = s.brand_id
where b.user_id = (select auth.uid());

grant select on public.shoot_portfolio_view to authenticated;

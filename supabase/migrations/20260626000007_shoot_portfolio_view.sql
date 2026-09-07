-- IPI-85 SHOOT-UX-002 — expose shoot.shoots to REST API via public view
-- security_invoker = true means the WHERE clause runs under the caller's JWT,
-- so each user sees only their own brand's shoots without a separate RLS policy.
-- Rollback: drop view public.shoot_portfolio_view;

-- security_definer (default) so the postgres owner can read shoot.shoots;
-- auth.uid() in the WHERE clause still filters to the caller's brands.
create or replace view public.shoot_portfolio_view as
select
  s.id,
  s.name,
  s.type::text             as type,
  s.status::text           as status,
  s.dna_score,
  s.target_channels::text[] as target_channels,
  s.estimated_budget,
  s.updated_at,
  s.brand_id,
  s.created_by
from shoot.shoots s
inner join public.brands b on b.id = s.brand_id
where b.user_id = (select auth.uid());

grant select on public.shoot_portfolio_view to authenticated;

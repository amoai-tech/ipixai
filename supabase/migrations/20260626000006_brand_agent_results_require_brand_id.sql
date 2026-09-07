-- IPI-26 fix: nullable brand_id rows were readable by any authenticated user

delete from public.brand_agent_results
where brand_id is null;

alter table public.brand_agent_results
  alter column brand_id set not null;

drop policy if exists "agent_results_select_org_member" on public.brand_agent_results;

create policy "agent_results_select_org_member"
  on public.brand_agent_results for select to authenticated
  using (
    exists (
      select 1 from public.brands b
      where b.id = brand_agent_results.brand_id
        and public.is_org_member(b.org_id)
    )
  );

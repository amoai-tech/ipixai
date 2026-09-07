-- IPI-362 follow-up — harden terminal-stage guard + wave-1 indexes

create or replace function public.crm_deals_guard_terminal_stage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.stage in ('won', 'lost')
       and coalesce(current_setting('app.crm_convert', true), '') <> '1' then
      raise exception 'crm_deals.stage may only be set to won/lost via api/crm/deals/[id]/convert (IPI-367)';
    end if;
  elsif tg_op = 'UPDATE' then
    if (new.stage in ('won', 'lost') or old.stage in ('won', 'lost'))
       and new.stage is distinct from old.stage
       and coalesce(current_setting('app.crm_convert', true), '') <> '1' then
      raise exception 'crm_deals.stage may only be set to won/lost via api/crm/deals/[id]/convert (IPI-367)';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.crm_deals_guard_terminal_stage() from public;
revoke all on function public.crm_deals_guard_terminal_stage() from anon, authenticated;

drop trigger if exists crm_deals_terminal_stage_guard on public.crm_deals;
create trigger crm_deals_terminal_stage_guard
  before insert or update on public.crm_deals
  for each row execute function public.crm_deals_guard_terminal_stage();

create index if not exists crm_companies_org_id_idx on public.crm_companies (org_id);
create index if not exists crm_contacts_org_id_idx on public.crm_contacts (org_id);
create index if not exists crm_deals_org_id_idx on public.crm_deals (org_id);
create index if not exists crm_deals_org_id_stage_idx on public.crm_deals (org_id, stage);
create index if not exists crm_activities_org_id_idx on public.crm_activities (org_id);
create index if not exists crm_activities_deal_id_idx on public.crm_activities (deal_id) where deal_id is not null;;

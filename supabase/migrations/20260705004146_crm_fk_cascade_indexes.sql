-- IPI-362 review fixes — explicit ON DELETE CASCADE, FK indexes, jsonb shape checks.

alter table public.crm_contacts
  drop constraint if exists crm_contacts_company_id_fkey;
alter table public.crm_contacts
  add constraint crm_contacts_company_id_fkey
  foreign key (company_id) references public.crm_companies(id) on delete cascade;

alter table public.crm_deals
  drop constraint if exists crm_deals_company_id_fkey;
alter table public.crm_deals
  add constraint crm_deals_company_id_fkey
  foreign key (company_id) references public.crm_companies(id) on delete cascade;

alter table public.crm_activities
  drop constraint if exists crm_activities_company_id_fkey;
alter table public.crm_activities
  add constraint crm_activities_company_id_fkey
  foreign key (company_id) references public.crm_companies(id) on delete cascade;

alter table public.crm_activities
  drop constraint if exists crm_activities_contact_id_fkey;
alter table public.crm_activities
  add constraint crm_activities_contact_id_fkey
  foreign key (contact_id) references public.crm_contacts(id) on delete cascade;

alter table public.crm_activities
  drop constraint if exists crm_activities_deal_id_fkey;
alter table public.crm_activities
  add constraint crm_activities_deal_id_fkey
  foreign key (deal_id) references public.crm_deals(id) on delete cascade;

alter table public.notifications
  drop constraint if exists notifications_crm_deal_id_fkey;
alter table public.notifications
  add constraint notifications_crm_deal_id_fkey
  foreign key (crm_deal_id) references public.crm_deals(id) on delete cascade;

create index if not exists crm_contacts_company_id_idx
  on public.crm_contacts (company_id)
  where company_id is not null;

create index if not exists crm_deals_company_id_idx
  on public.crm_deals (company_id);

create index if not exists crm_activities_company_id_idx
  on public.crm_activities (company_id)
  where company_id is not null;

create index if not exists crm_activities_contact_id_idx
  on public.crm_activities (contact_id)
  where contact_id is not null;

alter table public.crm_contacts
  drop constraint if exists crm_contacts_email_is_array;
alter table public.crm_contacts
  add constraint crm_contacts_email_is_array
  check (jsonb_typeof(email) = 'array');

alter table public.crm_contacts
  drop constraint if exists crm_contacts_phone_is_array;
alter table public.crm_contacts
  add constraint crm_contacts_phone_is_array
  check (jsonb_typeof(phone) = 'array');

create or replace function public.crm_deals_verify_convert_stage(
  p_deal_id uuid,
  p_stage text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_stage not in ('won', 'lost') then
    raise exception 'crm_deals_verify_convert_stage: stage must be won or lost';
  end if;
  perform set_config('app.crm_convert', '1', true);
  update public.crm_deals set stage = p_stage where id = p_deal_id;
end;
$$;

comment on function public.crm_deals_verify_convert_stage(uuid, text) is
  'verify-rls only: applies terminal stage with app.crm_convert=1 in same transaction. Not for app use — IPI-367 convert route owns production path.';

revoke all on function public.crm_deals_verify_convert_stage(uuid, text) from public;
revoke all on function public.crm_deals_verify_convert_stage(uuid, text) from anon, authenticated;;

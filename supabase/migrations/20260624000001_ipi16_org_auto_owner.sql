-- IPI-16 follow-up: auto-insert owner into org_members on org creation.
-- Solves chicken-and-egg: user can create an org (owner_id=auth.uid()),
-- trigger immediately makes them an org_member with role='owner',
-- so is_org_owner() returns true and subsequent member/brand inserts work.

create or replace function public.auto_add_org_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.org_members (org_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists organizations_auto_add_owner on public.organizations;
create trigger organizations_auto_add_owner
  after insert on public.organizations
  for each row execute function public.auto_add_org_owner();

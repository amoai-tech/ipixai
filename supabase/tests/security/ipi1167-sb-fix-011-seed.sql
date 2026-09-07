-- IPI-1167 · SB-FIX-011 — seed step: minimal mock schema + production's
-- exact *buggy* live block_brand_org_change() body (captured via read-only
-- pg_get_functiondef on 2026-09-07), so the CI job proves the fix migration
-- actually changes observable behavior, not just that the final state
-- happens to be correct. The function only touches brands(id, org_id) and
-- campaigns(brand_id), so this mocks just those two columns rather than
-- the full real schema — mirrors the minimal-mock style of
-- supabase/tests/security/ipi1147-sb-sec-010-seed.sql (which mocks
-- public.orgs / a hand-rolled auth.uid(), not the real migrated schema).

create table if not exists public.brands (
  id     uuid primary key default gen_random_uuid(),
  org_id uuid
);

create table if not exists public.campaigns (
  id        uuid primary key default gen_random_uuid(),
  brand_id  uuid not null references public.brands(id) on delete cascade
);

create or replace function public.block_brand_org_change()
returns trigger
security definer
set search_path = 'public'
as $$
begin
  if old.org_id != new.org_id and exists (select 1 from public.campaigns where brand_id = new.id) then
    raise exception 'Cannot change brand.org_id: % campaign(s) reference this brand',
      (select count(*) from public.campaigns where brand_id = new.id);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists block_brand_org_change on public.brands;
create trigger block_brand_org_change
  before update of org_id on public.brands
  for each row execute function public.block_brand_org_change();

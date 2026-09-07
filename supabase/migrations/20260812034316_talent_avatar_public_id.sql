-- TAL-IMG-001 — Add verified Cloudinary talent avatars to Matching
-- Smallest safe change: nullable avatar_public_id on talent_profiles,
-- exposed via talent_profiles_public view and existing search_talent RPC
-- (to_jsonb(t) auto-includes new column). No new RPC, RLS unchanged.
alter table talent.talent_profiles
  add column if not exists avatar_public_id text
  check (avatar_public_id is null or avatar_public_id ~ '^[A-Za-z0-9/_-]+$');

drop view if exists talent.talent_profiles_public;

create view talent.talent_profiles_public
  with (security_invoker = false) as
select
  id,
  display_name,
  bio,
  measurements,
  languages,
  travel_ready,
  verification_status,
  ai_tags,
  (agency_org_id is not null) as is_agency_represented,
  avatar_public_id,
  created_at
from talent.talent_profiles;

grant select on talent.talent_profiles_public to authenticated;
grant select on talent.talent_profiles_public to service_role;
revoke select on talent.talent_profiles_public from anon;

revoke all on function public.search_talent(text, text, date, date, text, uuid) from public, anon;
grant execute on function public.search_talent(text, text, date, date, text, uuid) to authenticated;

-- IPI-585 · SCR-24 — persist approved vs edited on provenance rows.
-- talent.talent_profile_sources had no review_status, so Finish dropped HITL
-- state and every source looked like raw AI. Mock analysis stays confidence 0.
--
-- Rollback:
--   alter table talent.talent_profile_sources drop column if exists review_status;
--   -- then restore create_talent_profile_with_sources from 20260818215030

alter table talent.talent_profile_sources
  add column if not exists review_status text not null default 'approved';

alter table talent.talent_profile_sources
  drop constraint if exists talent_profile_sources_review_status_check;

alter table talent.talent_profile_sources
  add constraint talent_profile_sources_review_status_check
  check (review_status in ('approved', 'edited'));

create or replace function public.create_talent_profile_with_sources(
  p_display_name text,
  p_bio text default null,
  p_handle text default null,
  p_niche text default null,
  p_location text default null,
  p_half_day numeric default null,
  p_languages text[] default '{}'::text[],
  p_source_url text default null,
  p_agency_org_id uuid default null,
  p_sources jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, talent
as $func$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_profile_id uuid;
  v_agency_org_id uuid;
  v_source jsonb;
  v_field_name text;
  v_confidence numeric;
  v_review_status text;
  v_sources_inserted integer := 0;
  v_source_count integer;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  if p_display_name is null or btrim(p_display_name) = '' then
    raise exception 'display_name is required';
  end if;

  if p_source_url is null or btrim(p_source_url) = '' then
    raise exception 'source_url is required';
  end if;

  if p_sources is null or jsonb_typeof(p_sources) is distinct from 'array' then
    raise exception 'sources must be a JSON array';
  end if;

  select jsonb_array_length(p_sources) into v_source_count;
  if v_source_count is null or v_source_count < 1 then
    raise exception 'at least one provenance source is required';
  end if;

  select role into v_role
  from public.profiles
  where id = v_uid;

  if p_agency_org_id is not null then
    if not public.is_org_editor_or_above(p_agency_org_id) then
      raise exception 'not an editor of this organization';
    end if;
    v_agency_org_id := p_agency_org_id;
    v_profile_id := null;
  else
    if v_role is distinct from 'model'
       and not exists (
         select 1
         from public.org_members m
         where m.user_id = v_uid
           and m.role in ('owner', 'editor')
       )
    then
      raise exception 'talent or agency role required';
    end if;
    v_profile_id := v_uid;
    v_agency_org_id := null;
  end if;

  insert into talent.talent_profiles (
    profile_id,
    agency_org_id,
    display_name,
    bio,
    measurements,
    rates,
    languages,
    travel_ready,
    verification_status,
    ai_tags
  )
  values (
    v_profile_id,
    v_agency_org_id,
    btrim(p_display_name),
    nullif(btrim(coalesce(p_bio, '')), ''),
    '{}'::jsonb,
    case
      when p_half_day is null then '{}'::jsonb
      else jsonb_build_object('half_day', p_half_day)
    end,
    coalesce(p_languages, '{}'::text[]),
    false,
    'pending',
    jsonb_strip_nulls(
      jsonb_build_object(
        'handle', nullif(btrim(coalesce(p_handle, '')), ''),
        'niche', nullif(btrim(coalesce(p_niche, '')), ''),
        'location', nullif(btrim(coalesce(p_location, '')), '')
      )
    )
  )
  returning id into v_profile_id;

  for v_source in select * from jsonb_array_elements(p_sources)
  loop
    v_field_name := nullif(btrim(coalesce(v_source->>'field_name', v_source->>'key', '')), '');
    v_review_status := coalesce(nullif(btrim(v_source->>'review_status'), ''), 'approved');
    begin
      v_confidence := (v_source->>'confidence')::numeric;
    exception
      when others then
        raise exception 'invalid source confidence';
    end;

    if v_field_name is null then
      raise exception 'source field_name is required';
    end if;

    if v_confidence is null or v_confidence < 0 or v_confidence > 100 then
      raise exception 'source confidence must be between 0 and 100';
    end if;

    if v_review_status not in ('approved', 'edited') then
      raise exception 'source review_status must be approved or edited';
    end if;

    insert into talent.talent_profile_sources (
      talent_profile_id,
      field_name,
      source_url,
      confidence,
      review_status
    )
    values (
      v_profile_id,
      v_field_name,
      btrim(p_source_url),
      v_confidence,
      v_review_status
    );

    v_sources_inserted := v_sources_inserted + 1;
  end loop;

  if v_sources_inserted <> v_source_count then
    raise exception 'failed to insert all provenance rows';
  end if;

  return jsonb_build_object(
    'id', v_profile_id,
    'display_name', btrim(p_display_name),
    'bio', nullif(btrim(coalesce(p_bio, '')), ''),
    'verification_status', 'pending',
    'sources_inserted', v_sources_inserted
  );
exception
  when unique_violation then
    raise exception 'talent profile already exists';
end;
$func$;

-- IPI-308 · MODEL-P2 — thin public-schema RPC bridge to the `talent` schema.
--
-- `talent` is deliberately not in supabase/config.toml's exposed Data API
-- schemas (same isolation as `shoot` — see 20260622120000_shoot_core_schema.sql's
-- own rationale). This repo's standard client (createSupabaseAdminClient(),
-- used by every existing Mastra tool) goes through PostgREST, so it cannot
-- reach talent.* tables directly. Matches the shoot_portfolio_view /
-- get_shoot_detail_rpc precedent: a narrow public-schema surface, not
-- exposing the whole schema.
--
-- No new tables — everything here reads/writes tables IPI-307 already created.
--
-- Rollback:
--   drop function if exists public.search_talent(text,text,date,date,text,uuid);
--   drop function if exists public.get_or_create_shortlist(uuid);
--   drop function if exists public.toggle_shortlist_item(uuid,uuid,boolean);
--   drop function if exists talent.compute_rate_tier(uuid);

-- ---------------------------------------------------------------------------
-- Coarse rate-tier bucket — reads the private `rates` jsonb inside the schema,
-- never returns raw numbers to a caller. Defensive against missing/malformed
-- data (rates shape isn't fixed yet) — returns null tier rather than erroring.
-- ---------------------------------------------------------------------------
create or replace function talent.compute_rate_tier(p_talent_profile_id uuid)
returns text
language plpgsql
stable
set search_path = talent
as $func$
declare
  v_half_day numeric;
begin
  select nullif(rates->>'half_day', '')::numeric into v_half_day
  from talent.talent_profiles where id = p_talent_profile_id;

  if v_half_day is null then return null; end if;
  if v_half_day < 500 then return '$';
  elsif v_half_day < 1500 then return '$$';
  else return '$$$';
  end if;
exception
  when others then return null; -- malformed rates jsonb never breaks search
end;
$func$;

-- ---------------------------------------------------------------------------
-- search_talent — filtered browse for the Talent tab. Any authenticated brand
-- may call this (talent_profiles_public is intentionally marketplace-browsable,
-- not org-scoped) — no is_org_member check here, only an auth check.
-- p_only_shortlist_id folds "view my shortlist" into the same function instead
-- of a 4th RPC.
-- ---------------------------------------------------------------------------
create or replace function public.search_talent(
  p_shoot_type text default null,
  p_budget_tier text default null,
  p_date_start date default null,
  p_date_end date default null,
  p_representation text default null,
  p_only_shortlist_id uuid default null
)
returns setof jsonb
language plpgsql
security definer
set search_path = public, talent
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  -- p_only_shortlist_id: mirror toggle_shortlist_item's ownership check —
  -- re-derive the shortlist's real owner org and require membership, rather
  -- than trusting that any authenticated caller may read any shortlist_id.
  if p_only_shortlist_id is not null then
    if not exists (
      select 1 from talent.talent_shortlists s
      where s.id = p_only_shortlist_id and public.is_org_member(s.owner_org_id)
    ) then
      raise exception 'not a member of this shortlist''s organization';
    end if;
  end if;

  -- daterange() raises a raw, unfriendly 'range lower bound must be less
  -- than or equal to range upper bound' error if start > end. Catch it here
  -- with a clear message rather than let the client's error UI show
  -- Postgres internals for a normal date-picker mistake.
  if p_date_start is not null and p_date_end is not null and p_date_start > p_date_end then
    raise exception 'invalid date range: start date must be on or before end date';
  end if;

  return query
  select to_jsonb(t) || jsonb_build_object(
    'rate_tier', talent.compute_rate_tier(t.id),
    -- No date filter at all -> no opinion, default to available (was
    -- previously checked *inside* the NOT EXISTS, which only bypassed the
    -- date check but still matched on status alone — any blocked/tentative/
    -- booked row EVER, past or future, incorrectly flagged every such talent
    -- unavailable on the default no-filter browse). `and` (not `or`) so a
    -- single provided date still runs a real open-ended-range overlap check
    -- instead of also bypassing — daterange() treats a null bound as
    -- unbounded on that side, no special-casing needed here.
    'is_available', (
      (p_date_start is null and p_date_end is null)
      or not exists (
        select 1 from talent.talent_availability a
        where a.talent_profile_id = t.id
          and a.status in ('blocked', 'tentative', 'booked')
          and a.date_range && daterange(p_date_start, p_date_end, '[]')
      )
    )
  )
  from talent.talent_profiles_public t
  where (
      p_representation is null
      or (p_representation = 'independent' and not t.is_agency_represented)
      or (p_representation = 'agency' and t.is_agency_represented)
    )
    and (p_budget_tier is null or talent.compute_rate_tier(t.id) = p_budget_tier)
    and (
      -- ai_tags.shoot_types is the same shape lib/talent/match-score.ts already
      -- reads client-side — mirror that contract here. Case-insensitive:
      -- UI SelectItems pass capitalized values ("Editorial") while stored/
      -- tested data uses lowercase ("editorial") — @> containment can't do
      -- case-insensitive matching, so unnest + lower() compare per element
      -- instead of leaving the filter silently returning zero rows.
      p_shoot_type is null
      or exists (
        select 1 from jsonb_array_elements_text(coalesce(t.ai_tags -> 'shoot_types', '[]'::jsonb)) st
        where lower(st) = lower(p_shoot_type)
      )
    )
    and (
      p_only_shortlist_id is null
      or exists (
        select 1 from talent.talent_shortlist_items i
        where i.shortlist_id = p_only_shortlist_id and i.talent_profile_id = t.id
      )
    )
  order by t.created_at desc
  limit 50;
end;
$$;

revoke all on function public.search_talent(text, text, date, date, text, uuid) from public, anon;
grant execute on function public.search_talent(text, text, date, date, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_or_create_shortlist — one shortlist per org for MVP (per-brand-org
-- default list, matching the "minimal list, not a board" scope). Enforces
-- org membership before any read/write.
--
-- CodeRabbit: the select-then-insert here was race-prone with only a
-- non-unique index on owner_org_id — two concurrent first-calls for the same
-- org could each pass the select-finds-nothing check and insert a duplicate
-- shortlist. A unique constraint + `insert ... on conflict do nothing`
-- (falling back to a select only if the insert lost the race) closes it.
-- ---------------------------------------------------------------------------
alter table talent.talent_shortlists
  add constraint talent_shortlists_owner_org_id_key unique (owner_org_id);

create or replace function public.get_or_create_shortlist(p_org_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, talent
as $$
declare
  v_id uuid;
begin
  if not public.is_org_member(p_org_id) then
    raise exception 'not a member of this organization';
  end if;

  insert into talent.talent_shortlists (owner_org_id, name)
  values (p_org_id, 'Shortlist')
  on conflict (owner_org_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id
    from talent.talent_shortlists
    where owner_org_id = p_org_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.get_or_create_shortlist(uuid) from public, anon;
grant execute on function public.get_or_create_shortlist(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- toggle_shortlist_item — add/remove. Re-derives the real owner org from the
-- shortlist row itself before checking membership — never trusts a
-- client-supplied org id, only the shortlist_id's actual owner.
-- ---------------------------------------------------------------------------
create or replace function public.toggle_shortlist_item(
  p_shortlist_id uuid,
  p_talent_profile_id uuid,
  p_add boolean
)
returns void
language plpgsql
security definer
set search_path = public, talent
as $$
declare
  v_owner_org_id uuid;
begin
  select owner_org_id into v_owner_org_id
  from talent.talent_shortlists
  where id = p_shortlist_id;

  if v_owner_org_id is null then
    raise exception 'shortlist not found';
  end if;

  if not public.is_org_member(v_owner_org_id) then
    raise exception 'not a member of this organization';
  end if;

  if p_add then
    insert into talent.talent_shortlist_items (shortlist_id, talent_profile_id)
    values (p_shortlist_id, p_talent_profile_id)
    on conflict (shortlist_id, talent_profile_id) do nothing;
  else
    delete from talent.talent_shortlist_items
    where shortlist_id = p_shortlist_id and talent_profile_id = p_talent_profile_id;
  end if;
end;
$$;

revoke all on function public.toggle_shortlist_item(uuid, uuid, boolean) from public, anon;
grant execute on function public.toggle_shortlist_item(uuid, uuid, boolean) to authenticated;

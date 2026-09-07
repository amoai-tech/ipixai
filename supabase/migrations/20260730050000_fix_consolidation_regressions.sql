-- Fix regressions introduced by the 2026-07-30 permissive-policy consolidation batch
-- (migrations 20260730032222 .. 20260730032949).
--
-- Forward-only. Does NOT edit the applied migrations — those are already in the
-- remote ledger and must stay byte-stable.
--
-- Raised in review of PR #674. Each fix below was verified against the live
-- database before writing; see the PR body for the probe output.

-- ---------------------------------------------------------------------------
-- 1. P1 — organizer_team_members is currently UNREADABLE
--
-- 20260730032549 created organizer_team_members_select with a USING clause that
-- queries organizer_team_members from inside its own policy. Verified live:
--
--   SET LOCAL role authenticated;
--   SELECT count(*) FROM public.organizer_team_members;
--   ERROR:  infinite recursion detected in policy for relation "organizer_team_members"
--
-- Every authenticated read of the table errors out. Break the cycle with a
-- SECURITY DEFINER helper, which runs as the owner and therefore bypasses RLS on
-- the inner lookup. Same pattern as public.planner_get_my_assignment.
-- ---------------------------------------------------------------------------

create or replace function public.is_organizer_team_member(p_team_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.organizer_team_members otm
    where otm.team_id = p_team_id
      and otm.user_id = (select auth.uid())
  );
$$;

comment on function public.is_organizer_team_member(uuid) is
  'INTENTIONAL-DEFINER: RLS helper. Breaks the self-referential recursion in '
  'organizer_team_members_select by bypassing RLS on the inner lookup. Scoped to '
  'auth.uid(); never accepts a caller-supplied user id. authenticated needs EXECUTE '
  'because RLS evaluates policy expressions as the querying role — same rationale as '
  'is_org_member (see IPI-679 step S4).';

revoke execute on function public.is_organizer_team_member(uuid) from public, anon;
grant execute on function public.is_organizer_team_member(uuid) to authenticated;

alter policy organizer_team_members_select on public.organizer_team_members
  using (
    user_id = (select auth.uid())
    or public.is_organizer_team_member(team_id)
    or exists (
      select 1
      from public.organizer_teams
      where organizer_teams.id = organizer_team_members.team_id
        and organizer_teams.owner_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 2. P2 — brand_scores upserts break on any fresh/branch replay
--
-- 20260730032222 drops brand_scores_brand_id_score_type_uidx and claims
-- brand_scores_brand_id_score_type_key survives. On the live database that is
-- true, but _key is created by NO migration in this repo — it is only ever
-- dropped. Verified:
--
--   grep -rl brand_scores_brand_id_score_type_key supabase/migrations/
--     -> only 20260730032222 (the drop)
--   grep -rl brand_scores_brand_id_score_type_uidx supabase/migrations/
--     -> 20260625000000_brand_scores_unique_update_rls.sql (the create)
--
-- So replaying these files onto a fresh project or preview branch creates _uidx,
-- drops it, and leaves NO unique index on (brand_id, score_type). That breaks
-- app/src/lib/brand/promote-draft.ts:54:
--   .upsert(scoreRows, { onConflict: "brand_id,score_type" })
-- with 42P10 "no unique or exclusion constraint matching the ON CONFLICT
-- specification".
--
-- Idempotent: no-op on the live database where _key already exists.
-- ---------------------------------------------------------------------------

create unique index if not exists brand_scores_brand_id_score_type_key
  on public.brand_scores (brand_id, score_type);

-- ---------------------------------------------------------------------------
-- 3. P2 — anon lost read access to published rehearsals
--
-- 20260730032914 dropped public_select_event_rehearsals (created TO anon by
-- 20251129070533) and replaced it with event_rehearsals_select, granted only to
-- authenticated. Verified live: event_rehearsals has 4 policies, all
-- {authenticated}, and anon holds a SELECT grant on the table — so the anon path
-- is reachable and did regress.
-- ---------------------------------------------------------------------------

create policy event_rehearsals_select_anon on public.event_rehearsals
  for select
  to anon
  using (
    exists (
      select 1
      from public.events
      where events.id = event_rehearsals.event_id
        and events.status = 'published'::public.event_status
    )
  );

-- ---------------------------------------------------------------------------
-- 4. P2 — organizers lost UPDATE on assigned designer profiles
--
-- 20260730032722 dropped the organizer branch added by 20260117025240, leaving
-- authenticated_update_fashion_show_designer_profiles as the only UPDATE policy:
--   ((auth.uid() = user_id) OR (user_id IS NULL))
--
-- Verified live: the SELECT policy kept its organizer branch
-- (e.organizer_id = (SELECT auth.uid())) but UPDATE did not — an asymmetry that
-- confirms the loss. An organizer editing a designer profile owned by someone
-- else now hits an RLS denial.
-- ---------------------------------------------------------------------------

alter policy authenticated_update_fashion_show_designer_profiles
  on public.fashion_show_designer_profiles
  using (
    (select auth.uid()) = user_id
    or user_id is null
    or exists (
      select 1
      from public.event_designers ed
      join public.events e on e.id = ed.event_id
      where ed.designer_id = fashion_show_designer_profiles.id
        and e.organizer_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) = user_id
    or user_id is null
    or exists (
      select 1
      from public.event_designers ed
      join public.events e on e.id = ed.event_id
      where ed.designer_id = fashion_show_designer_profiles.id
        and e.organizer_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 5. auth_rls_initplan — wrap auth.uid() in the policies this migration touches
--
-- The consolidation batch wrote several new policies with bare auth.uid(), which
-- re-evaluates per row. Wrapped as (select auth.uid()) above wherever this
-- migration already rewrites a policy, since it costs nothing while we are here.
--
-- Deliberately NOT wrapping the other policies the review listed
-- (ticket_tiers, model_availability, call_times, event_designers, event_phases,
-- events). Rewriting them is a separate concern with its own review surface, and
-- all are FashionOS-legacy tables outside the iPix MVP read path. Tracked by
-- IPI-864 / IPI-865, which carry the corrected ALTER POLICY form and the
-- 13-policy iPix-core scope.
--
-- NOT addressed here, with reason:
--   model_availability_select's `(event_id IS NULL)` branch lets any
--   authenticated user read every row with a null event_id. Traced to
--   20250125000010_create_scheduling_availability.sql — pre-existing, inherited
--   by the consolidation rather than introduced by it. Deserves its own ticket
--   rather than being smuggled into a regression fix.
-- ---------------------------------------------------------------------------

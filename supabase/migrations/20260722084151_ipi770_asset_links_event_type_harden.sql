-- IPI-770 follow-up: require entity_type = 'event' on the legacy
-- event-organizer SELECT branch so idx_asset_links_entity (entity_type,
-- entity_id) can be used and UUID collisions across entity kinds cannot
-- match events by id alone.
--
-- Live policy from 20260722083700 is replaced in place (SELECT only).

drop policy if exists "asset_links_select_via_asset_brand_or_event" on public.asset_links;

create policy "asset_links_select_via_asset_brand_or_event"
  on public.asset_links for select to authenticated
  using (
    exists (
      select 1
      from public.assets a
      join public.brands b on b.id = a.brand_id
      where a.id = asset_links.asset_id
        and (
          (b.org_id is null and b.user_id = (select auth.uid()))
          or (b.org_id is not null and public.is_org_member(b.org_id))
        )
    )
    or exists (
      select 1
      from public.events e
      where e.id = asset_links.entity_id
        and asset_links.entity_type = 'event'
        and e.organizer_id = (select auth.uid())
    )
  );

comment on policy "asset_links_select_via_asset_brand_or_event" on public.asset_links is
  'IPI-770 — SELECT when parent asset brand is visible (owner or org member), or linked event (entity_type=event) owned by caller. Writes unchanged.';

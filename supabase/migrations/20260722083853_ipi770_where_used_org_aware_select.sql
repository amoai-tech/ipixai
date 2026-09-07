-- IPI-770 · CLD-WHERE-USED-RLS-001
-- Align Where Used child SELECT with org-aware assets_select_via_brand.
--
-- Problem: org members can SELECT parent assets (and open /app/assets/[id])
-- but PostgREST embeds for asset_links / commerce_product_links still apply
-- owner-only policies, so Where Used silently omits shoot/product rows.
--
-- SELECT only — insert/update/delete stay as previously shipped.

-- ---------------------------------------------------------------------------
-- commerce_product_links: brand owner OR org member (mirror assets SELECT)
-- ---------------------------------------------------------------------------
drop policy if exists "commerce_product_links_select_via_brand" on public.commerce_product_links;

create policy "commerce_product_links_select_via_brand"
  on public.commerce_product_links for select to authenticated
  using (
    exists (
      select 1 from public.brands b
      where b.id = commerce_product_links.brand_id
        and (
          (b.org_id is null and b.user_id = (select auth.uid()))
          or (b.org_id is not null and public.is_org_member(b.org_id))
        )
    )
  );

comment on policy "commerce_product_links_select_via_brand" on public.commerce_product_links is
  'IPI-770 — SELECT via brand ownership or is_org_member (aligned with assets_select_via_brand). Writes unchanged.';

-- ---------------------------------------------------------------------------
-- asset_links: via parent asset → brand (org-aware) OR legacy event organizer
-- ---------------------------------------------------------------------------
drop policy if exists "Users can view asset links for their own entities" on public.asset_links;

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
        and e.organizer_id = (select auth.uid())
    )
  );

comment on policy "asset_links_select_via_asset_brand_or_event" on public.asset_links is
  'IPI-770 — SELECT when the parent asset brand is visible to the caller (owner or org member), or when the linked event is owned by the caller (legacy path). Writes unchanged.';

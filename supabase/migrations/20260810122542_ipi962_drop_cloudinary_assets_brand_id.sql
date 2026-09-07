-- ============================================================================
-- Migration: IPI-962 PR2 — Drop duplicate cloudinary_assets.brand_id + dependent RLS/index
-- Issue:     IPI-962 · CLD-INTEGRITY-001
-- Purpose:   Remove unenforced duplicate column that was denormalized from
--            assets.brand_id. PR1 (e9e62d876) already stopped reading/writing
--            the column in app code (webhook/status/e2e/live verifier now
--            resolve via assets.brand_id through asset_id). This migration
--            recreates RLS without the mirror brand_id guard, drops the
--            partial index, and drops the column + FK. Zero-downtime:
--            PR1 + old DB (column exists but unwritten, RLS allows IS NULL) is
--            safe; PR2 + new DB (column absent, RLS without brand_id) is safe;
--            old app + new DB would break, which is why PR2 is separate.
-- Depends:   20260716115854_ipi276_assets_cloudinary_org_rls.sql (last org-aware RLS)
--            20260630143000_cloudinary_assets_brand_id_rls_enforcement.sql (added brand_id guard)
-- Safety:    Idempotent drops. Table is small. No app code in this PR.
-- ============================================================================

-- 1. Recreate ca_insert_via_brand without mirror brand_id clause
drop policy if exists "ca_insert_via_brand" on public.cloudinary_assets;
create policy "ca_insert_via_brand"
  on public.cloudinary_assets for insert to authenticated
  with check (
    exists (
      select 1
      from public.assets a
      join public.brands b on b.id = a.brand_id
      where a.id = cloudinary_assets.asset_id
        and (
          (b.org_id is null and b.user_id = (select auth.uid()))
          or (b.org_id is not null and public.is_org_member(b.org_id))
        )
    )
  );

-- 2. Recreate ca_update_via_brand without mirror brand_id clause (both USING and WITH CHECK)
drop policy if exists "ca_update_via_brand" on public.cloudinary_assets;
create policy "ca_update_via_brand"
  on public.cloudinary_assets for update to authenticated
  using (
    exists (
      select 1
      from public.assets a
      join public.brands b on b.id = a.brand_id
      where a.id = cloudinary_assets.asset_id
        and (
          (b.org_id is null and b.user_id = (select auth.uid()))
          or (b.org_id is not null and public.is_org_member(b.org_id))
        )
    )
  )
  with check (
    exists (
      select 1
      from public.assets a
      join public.brands b on b.id = a.brand_id
      where a.id = cloudinary_assets.asset_id
        and (
          (b.org_id is null and b.user_id = (select auth.uid()))
          or (b.org_id is not null and public.is_org_member(b.org_id))
        )
    )
  );

-- 3. Drop dependent partial index (depends on brand_id)
drop index if exists public.idx_cloudinary_assets_brand;

-- 4. Drop FK and column (FK is ON DELETE SET NULL, column is nullable)
alter table public.cloudinary_assets
  drop constraint if exists cloudinary_assets_brand_id_fkey;

alter table public.cloudinary_assets
  drop column if exists brand_id;

-- 5. Comment for traceability
comment on table public.cloudinary_assets is 'IPI-962 — brand ownership is via assets.brand_id through asset_id; mirror brand_id removed.';

-- IPI-767 · CLD-DATA-HYGIENE-001 — guarded brand ownership backfill
--
-- STATUS: APPLIED 2026-08-05 (supabase db push --linked, project
-- nvdlhrodvevgwdsneplk). Human approval recorded on IPI-767. Idempotent —
-- re-running updates 0 rows because brand_id is no longer null.
-- Live before counts (2026-08-05, Supabase MCP): cloudinary_assets 8 (7 null,
-- 1 set) · assets 36 (17 null, 19 set) · brands with null org_id 0.
--
-- Deterministic rules (only):
--   R1  exact valid brand UUID in Cloudinary folder path
--   R2  exact valid brand UUID in context or structured metadata (0 matches)
--   R3  shoot_id set on legacy shoots (no brand on shoots) -> leave (IPI-524)
--   R4  no valid evidence / fake UUID / demo seeds -> leave or delete-needs-signoff
--
-- Guarded update contract:
--   * only approved row IDs
--   * WHERE brand_id IS NULL — never overwrites existing ownership
--   * no weak heuristics, no mass assignment
--   * no DELETE (proofs/legacy rows need explicit product sign-off)
--   * idempotent: re-running updates 0 rows after the first apply
--
-- Target row: ipi-60-realworld-fixture-20260720T164824Z — QA fixture whose
-- folder path contains the exact valid brand UUID db1f728d-bee1-430e-a3e7-
-- 0c601da74ce7 (verified present in public.brands, 2026-08-05).

begin;

update public.assets
set brand_id = 'db1f728d-bee1-430e-a3e7-0c601da74ce7'
where id = '2531dbdd-407d-4189-96ad-d9d8275cedc8'
  and brand_id is null;

update public.cloudinary_assets
set brand_id = 'db1f728d-bee1-430e-a3e7-0c601da74ce7'
where id = '8b13a8d6-9f51-42be-8295-6c987b4635a5'
  and brand_id is null;

commit;

-- Post-condition (expect: cloudinary_assets 6 null · assets 16 null · 0 FK orphans)
-- select count(*) from public.cloudinary_assets where brand_id is null;
-- select count(*) from public.assets where brand_id is null;
--
-- NOT NULL constraint on assets.brand_id / cloudinary_assets.brand_id is
-- explicitly DEFERRED (AC6): 6 + 16 legitimate null rows remain after apply
-- (legacy FashionOS, shoot-linked seeds per IPI-524, Cloudinary demo seeds).

-- ============================================================================
-- Migration: IPI-441 CLD-118 — Asset Activity Timeline (minimal v1)
-- Purpose:   Append-only chronological log for every asset change.
--            Unblocks IPI-639 (approval audit) and IPI-437 (approval UI).
-- Design:    Plain table + RLS org-aware via assets.brand_id → is_org_member.
--            No JSONB history array (append-only table is indexable, RLS per row,
--            exact cloudinary_asset_id+version binding — see todo.md §293).
--            v1 kinds locked: upload / rename / overwrite / moderated / approved / rejected.
--            Future kinds (deleted/restored/archived/exported/analyzed/metadata_updated)
--            can be added via ADD CONSTRAINT without rewrite — keep check minimal now.
-- Cloudinary: Native webhook events (upload/eager/rename/delete) + Admin API
--             asset history are delivery-only; timeline is Supabase SoT.
-- Safety:    Additive + idempotent. No backfill — forward writes only.
-- Tenant iso: is_org_member(b.org_id) via assets.brand_id (org-only, IPI-956).
--            Webhook uses service_role and bypasses RLS; app reads via RLS.
-- Rollback:  see commented DROP at bottom.
-- ============================================================================

begin;

-- 1. Table -------------------------------------------------------------------
create table if not exists public.asset_events (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  cloudinary_asset_id text,
  version bigint,
  kind text not null check (kind in ('upload','rename','overwrite','moderated','approved','rejected','deleted','archived')),
  actor_id uuid references auth.users(id) on delete set null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.asset_events is 'IPI-441 — append-only asset activity timeline. One row per webhook/API event, exact cloudinary_asset_id+version binding, tenant-isolated via assets.brand_id.';
comment on column public.asset_events.asset_id is 'FK to assets.id — canonical local asset (survives renames).';
comment on column public.asset_events.cloudinary_asset_id is 'Cloudinary immutable asset_id (hex) — nullable for legacy rows.';
comment on column public.asset_events.version is 'Cloudinary provider version at event time — nullable when unknown.';
comment on column public.asset_events.kind is 'v1: upload/rename/overwrite/moderated/approved/rejected. Future: deleted/restored/archived/exported/analyzed via check expansion.';
comment on column public.asset_events.metadata is 'Optional structured details (e.g. moderation_kind, from_public_id). Keep small — not a SoT copy of Cloudinary payload.';

-- 2. Indexes -----------------------------------------------------------------
create index if not exists idx_asset_events_asset_id on public.asset_events(asset_id);
create index if not exists idx_asset_events_cloudinary_asset_id on public.asset_events(cloudinary_asset_id) where cloudinary_asset_id is not null;
create index if not exists idx_asset_events_asset_kind_created on public.asset_events(asset_id, created_at desc);

-- 3. RLS ---------------------------------------------------------------------
alter table public.asset_events enable row level security;

drop policy if exists "asset_events_select" on public.asset_events;
create policy "asset_events_select"
  on public.asset_events for select to authenticated
  using (
    exists (
      select 1
      from public.assets a
      join public.brands b on b.id = a.brand_id
      where a.id = asset_events.asset_id
        and public.is_org_member(b.org_id)
    )
  );

-- No INSERT/UPDATE/DELETE policies for authenticated — writes only via service_role webhook/RPC (append-only).
-- Service role (webhook) bypasses RLS; no with_check bypass needed.

comment on policy "asset_events_select" on public.asset_events is 'IPI-441 — org members of the owning brand can read timeline.';

commit;

-- ============================================================================
-- ROLLBACK (manual — run as a separate down migration if needed)
-- ----------------------------------------------------------------------------
-- begin;
-- drop policy if exists "asset_events_insert" on public.asset_events;
-- drop policy if exists "asset_events_select" on public.asset_events;
-- drop table if exists public.asset_events;
-- commit;
-- ============================================================================

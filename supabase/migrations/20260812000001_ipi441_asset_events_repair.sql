-- IPI-441 repair — normalize legacy asset_events (remote had request_id + narrow kind check)
-- This migration is idempotent: handles both fresh (empty) and legacy (request_id) installs.
begin;

-- Preserve request_id data — drop only obsolete unique constraint/index, keep column
alter table public.asset_events drop constraint if exists asset_events_request_id_key;
drop index if exists public.asset_events_request_id_key;
drop index if exists public.asset_events_request_id_idx;

-- Ensure v1 columns
alter table public.asset_events add column if not exists actor_id uuid references auth.users(id) on delete set null;
alter table public.asset_events add column if not exists reason text;
alter table public.asset_events add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Normalize kind check to v1+archived/deleted
alter table public.asset_events drop constraint if exists asset_events_kind_check;
alter table public.asset_events add constraint asset_events_kind_check check (kind in ('upload','rename','overwrite','moderated','approved','rejected','deleted','archived'));

-- Indexes (idempotent)
create index if not exists idx_asset_events_asset_id on public.asset_events(asset_id);
create index if not exists idx_asset_events_cloudinary_asset_id on public.asset_events(cloudinary_asset_id) where cloudinary_asset_id is not null;
create index if not exists idx_asset_events_asset_kind_created on public.asset_events(asset_id, created_at desc);

-- RLS: org-only (IPI-956) — replace stale dual org_id/user_id predicate
-- No authenticated INSERT — writes only via service_role webhook/RPC
drop policy if exists asset_events_select on public.asset_events;
drop policy if exists asset_events_insert on public.asset_events;
drop policy if exists asset_events_insert_service on public.asset_events;

create policy asset_events_select on public.asset_events for select to authenticated
  using (exists (select 1 from public.assets a join public.brands b on b.id=a.brand_id where a.id=asset_events.asset_id and public.is_org_member(b.org_id)));

commit;

-- IPI-441 hardening — address P2 review findings
-- - Grant table privileges to authenticated (required after 20260801091009 revokes default)
-- - Revoke service_role mutation (append-only audit)
-- - Preserve audit on asset delete (restrict, not cascade)
begin;

-- Grants: authenticated needs explicit SELECT post-IPI-896 (no INSERT — writes via service_role webhook/RPC only)
grant select on table public.asset_events to authenticated;
revoke insert on table public.asset_events from authenticated;

-- Service role retains insert+select for webhook, but revoke mutation to enforce append-only
revoke update, delete, truncate on table public.asset_events from service_role;

-- Idempotency: Cloudinary X-Cld-Request-Id header / payload.request_id
-- Preserve request_id data; enforce uniqueness per asset to allow multi-resource deletes sharing one request_id
alter table public.asset_events add column if not exists request_id text;
drop index if exists asset_events_request_id_key;
create unique index if not exists asset_events_request_id_key on public.asset_events(request_id, asset_id) where request_id is not null;
create index if not exists asset_events_request_id_idx on public.asset_events(request_id) where request_id is not null;

-- Preserve audit: prevent parent asset deletion from silently wiping history
-- Drop cascade FK and re-add as restrict
alter table public.asset_events drop constraint if exists asset_events_asset_id_fkey;
alter table public.asset_events add constraint asset_events_asset_id_fkey
  foreign key (asset_id) references public.assets(id) on delete restrict;

comment on constraint asset_events_asset_id_fkey on public.asset_events is 'IPI-441 — restrict delete of asset while audit events exist (preserve history).';
comment on column public.asset_events.request_id is 'IPI-441 — Cloudinary request_id / X-Cld-Request-Id for idempotent deduplication (unique where not null).';

commit;

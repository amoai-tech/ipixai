-- IPI-441 follow-up: address inline-review findings after initial hardening
-- - Remove authenticated INSERT (writes only via service_role webhook/RPC)
-- - Preserve request_id data (repair previously dropped column — already re-added in 00002, no data to restore)
-- - Replace global request_id unique with composite (request_id, asset_id) to allow multi-resource deletes sharing one request_id
begin;

-- 1. Remove authenticated INSERT policy and grant (keep SELECT only)
drop policy if exists "asset_events_insert" on public.asset_events;
drop policy if exists asset_events_insert on public.asset_events;
revoke insert on table public.asset_events from authenticated;
-- Ensure SELECT remains granted (idempotent)
grant select on table public.asset_events to authenticated;

-- 2. Replace global unique with composite uniqueness per asset
drop index if exists asset_events_request_id_key;
-- Old global index was (request_id) where not null; new is composite
create unique index if not exists asset_events_request_id_key on public.asset_events(request_id, asset_id) where request_id is not null;
-- Keep non-unique lookup index for header queries
create index if not exists asset_events_request_id_idx on public.asset_events(request_id) where request_id is not null;

commit;

-- IPI-V2-000 · SB-FIX-004 — Backend/service-role only tables stay fail-closed.
-- Do not add USING (true). Chatbot/Firecrawl already have no JWT DML.
-- media_size_specs still had leftover REFERENCES/TRIGGER/TRUNCATE for JWT roles.
--
-- Rollback: drop comments; re-grant leftover table privs only if a product caller needs them
-- (none in app/).

revoke all on table public.media_size_specs from public, anon, authenticated;

comment on table public.chatbot_conversations is
  'Backend/service-role only; intentionally fail-closed. No JWT SELECT/DML.';
comment on table public.chatbot_messages is
  'Backend/service-role only; intentionally fail-closed. No JWT SELECT/DML.';
comment on table public.chatbot_events is
  'Backend/service-role only; intentionally fail-closed. No JWT SELECT/DML.';
comment on table public.processed_firecrawl_webhooks is
  'Backend/service-role only; intentionally fail-closed. HMAC webhook path uses service_role.';
comment on table public.media_size_specs is
  'Retired lookup (CLD-SPEC-001). Backend/service-role only; intentionally fail-closed. Use image_specs.';

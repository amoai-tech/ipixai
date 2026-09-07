-- IPI-664 · SB-HYGIENE-001 — service-only chatbot table privileges
--
-- chatbot_conversations / chatbot_messages / chatbot_events are written by
-- trusted Edge (capture-lead via service_role). Default table grants also
-- exposed full DML to anon + authenticated through PostgREST even though RLS
-- default-denies rows. Align privileges with the original WEB-015 intent:
-- service_role only.

revoke all on table public.chatbot_conversations from anon, authenticated;
revoke all on table public.chatbot_messages from anon, authenticated;
revoke all on table public.chatbot_events from anon, authenticated;

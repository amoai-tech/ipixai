-- IPI-872 · SB-HYGIENE-003 — re-revoke chatbot_* SELECT from anon/authenticated
--
-- IPI-664 (20260718120000) revoked chatbot DML from anon/authenticated, but
-- live privileges drifted back to SELECT (likely via PUBLIC / default ACLs).
-- supabase/tests/security/chatbot-grants.sql fails on current main CI.
--
-- Re-assert service-only access for capture-lead (service_role). Also revoke
-- from PUBLIC so information_schema.table_privileges stays clean under
-- inherited grants. Idempotent: safe if already revoked.

revoke all on table public.chatbot_conversations from anon, authenticated, public;
revoke all on table public.chatbot_messages from anon, authenticated, public;
revoke all on table public.chatbot_events from anon, authenticated, public;

grant select, insert, update, delete
  on table public.chatbot_conversations,
     public.chatbot_messages,
     public.chatbot_events
  to service_role;

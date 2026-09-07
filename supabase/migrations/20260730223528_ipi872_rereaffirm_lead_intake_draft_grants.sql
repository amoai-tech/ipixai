-- IPI-872 · SB-HYGIENE-003 (companion) — reaffirm lead_intake_drafts grant matrix
--
-- Same privilege drift class as chatbot_*: anon regained SELECT on
-- lead_intake_drafts after IPI-677 (20260718180000). chatbot-grants.sql (IPI-668)
-- asserts both matrices; without this reaffirm the CI gate stays red even after
-- the chatbot REVOKE. Restore IPI-677 intent — not a redesign:
--   - anon / PUBLIC: no table privileges
--   - authenticated: SELECT only (RLS owner gate unchanged)
--   - service_role: leave DML intact (capture-lead / claim path)

revoke all on table public.lead_intake_drafts from anon, authenticated, public;

grant select on table public.lead_intake_drafts to authenticated;

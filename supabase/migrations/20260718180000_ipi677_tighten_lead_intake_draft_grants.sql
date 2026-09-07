-- IPI-677 · SB-HYGIENE-002 — tighten lead_intake_drafts table privileges
--
-- Default Postgres/PostgREST grants left anon + authenticated with full DML
-- on lead_intake_drafts even though RLS only allows owner SELECT. IPI-664
-- revoked privileges on chatbot_* only. Align with WEB-015 intent:
--   - anon: no table privileges
--   - authenticated: SELECT only (RLS: user_id = auth.uid())
--   - service_role: unchanged (full DML for Edge / claim_lead_draft path)

revoke all on table public.lead_intake_drafts from anon, authenticated;

grant select on table public.lead_intake_drafts to authenticated;

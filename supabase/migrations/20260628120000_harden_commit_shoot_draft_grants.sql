-- IPI-225 — align live grants with service-role-only commit path (/api/shoots/commit)
-- Remote had PUBLIC/authenticated EXECUTE from initial deploy; route uses service_role only.

REVOKE ALL ON FUNCTION public.commit_shoot_draft(
  uuid, text, text, text[], numeric, jsonb, uuid, jsonb, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_shoot_draft(
  uuid, text, text, text[], numeric, jsonb, uuid, jsonb, jsonb
) TO service_role;

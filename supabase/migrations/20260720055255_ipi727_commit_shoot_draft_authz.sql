-- IPI-727 SHOOT-SEC-001 — defense-in-depth org check inside commit_shoot_draft
--
-- public.commit_shoot_draft (SECURITY DEFINER) inserted into shoot.shoots /
-- shoot.shoot_deliverables / shoot.shot_list using p_brand_id and p_created_by
-- exactly as passed by the caller, with no authorization check of its own.
--
-- Investigated 2026-07-20 (IPI-721 follow-up) — NOT exploitable in production
-- today: EXECUTE on this function is granted only to service_role/postgres
-- (no other caller reaches it via PostgREST), and its one real caller
-- (app/src/lib/shoot/commit-shoot-draft.ts -> POST /api/shoots/commit)
-- already checks p_brand_id against the RLS-gated `brands_select_org` policy
-- (is_org_member) before invoking the RPC, and derives p_created_by from the
-- authenticated session server-side (never from client input). This migration
-- closes the gap anyway so the RPC doesn't rely entirely on every future
-- caller remembering to replicate that check.
--
-- IMPORTANT: this function is invoked via a bare service-role client
-- (createSupabaseAdminClient() -> no user JWT forwarded), so auth.uid() is
-- NULL on the real call path -- unlike create_booking_request, which is
-- called via the caller's own session-scoped client. A raw auth.uid() check
-- here would reject every legitimate call. Instead, this validates the
-- already-trusted p_created_by parameter (proven server-derived, not
-- client-spoofable -- see investigation above) directly against org
-- membership, bypassing is_org_member() (which itself reads auth.uid()
-- internally and would be equally useless here).
--
-- p_created_by can be NULL only via the local-dev auth-disabled fallback
-- (OPERATOR_AUTH_ENABLED != "true", never true on preview/production runtimes
-- per withOperatorAuth's own doc comment) -- the check is skipped in that
-- case to avoid breaking local dev, not because a NULL actor is trusted.
--
-- Rollback: `create or replace function public.commit_shoot_draft(...)` with
-- this authorization block removed (prior body preserved verbatim below it).

create or replace function public.commit_shoot_draft(
  p_brand_id uuid,
  p_name text,
  p_brief text DEFAULT NULL::text,
  p_target_channels text[] DEFAULT '{}'::text[],
  p_estimated_budget numeric DEFAULT 0,
  p_budget_breakdown jsonb DEFAULT NULL::jsonb,
  p_created_by uuid DEFAULT NULL::uuid,
  p_deliverables jsonb DEFAULT '[]'::jsonb,
  p_shots jsonb DEFAULT '[]'::jsonb
)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'shoot'
as $function$
DECLARE
  v_shoot_id uuid;
  v_item     jsonb;
BEGIN
  IF p_created_by IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.brands b
    WHERE b.id = p_brand_id
      AND (
        (b.org_id IS NULL AND b.user_id = p_created_by)
        OR (b.org_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.org_members m
          WHERE m.org_id = b.org_id AND m.user_id = p_created_by
        ))
      )
  ) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  INSERT INTO shoot.shoots (
    brand_id, name, type, brief,
    target_channels, estimated_budget, budget_breakdown,
    created_by, status
  ) VALUES (
    p_brand_id, p_name, 'studio_ecommerce', p_brief,
    p_target_channels::shoot.channel[],
    p_estimated_budget, p_budget_breakdown,
    p_created_by, 'planning'
  )
  RETURNING id INTO v_shoot_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_deliverables)
  LOOP
    INSERT INTO shoot.shoot_deliverables (shoot_id, channel, format, quantity, origin)
    VALUES (
      v_shoot_id,
      (v_item->>'channel')::shoot.channel,
      NULLIF(v_item->>'format', ''),
      (v_item->>'quantity')::integer,
      'ai_approved'
    );
  END LOOP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_shots)
  LOOP
    INSERT INTO shoot.shot_list (shoot_id, description, style_notes, "order", origin, status)
    VALUES (
      v_shoot_id,
      v_item->>'description',
      NULLIF(v_item->>'style_notes', ''),
      (v_item->>'order')::integer,
      'ai_approved',
      'pending'
    );
  END LOOP;

  RETURN jsonb_build_object('shoot_id', v_shoot_id);
END;
$function$;

comment on function public.commit_shoot_draft(uuid, text, text, text[], numeric, jsonb, uuid, jsonb, jsonb) is
  'IPI-727 — defense-in-depth: when p_created_by is provided, it must be a member of p_brand_id''s org (or the legacy personal owner). The real production caller (POST /api/shoots/commit) already enforces this via RLS on brands before calling this RPC; this closes the gap for any future caller that might not.';

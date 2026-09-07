-- IPI-732 SHOOT-SEC-002 — restrict shoot creation to org owners/editors.
--
-- IPI-727 (20260720055255) closed the cross-org gap inside commit_shoot_draft
-- but only proved organization MEMBERSHIP, not ROLE — a viewer satisfied the
-- same EXISTS check as an owner/editor and could still create a shoot.
-- Forward migration only; the IPI-727 migration file is not edited.
--
-- NULL-actor decision (explicit, not inherited): p_created_by IS NULL used to
-- skip the authorization check entirely, reached only via the local
-- `next dev` auth-disabled fallback (operator id "dev-unauthenticated" fails
-- the uuid check in commitShootDraft() -> createdBy = null). A shared
-- database has no way to distinguish "a trusted local dev call" from any
-- other privileged caller that simply omitted the actor — so that bypass is
-- now REJECTED. Local development that needs to actually persist a shoot
-- must use a real authenticated session (the existing qa@ipix.test seeded
-- account, same as any other environment) instead of the auth-disabled
-- shortcut; this is an already-available replacement, not a new prerequisite.
--
-- Does not use public.is_org_editor_or_above() here: that helper reads
-- (select auth.uid()), which is NULL under this function's service-role/
-- SECURITY DEFINER execution context (the caller is always the service-role
-- client, not the end user's own session) — it would incorrectly evaluate to
-- false for every caller. The role check below is explicit and keyed off
-- p_created_by instead.

create or replace function public.commit_shoot_draft(
  p_brand_id uuid,
  p_name text,
  p_brief text default null,
  p_target_channels text[] default '{}',
  p_estimated_budget numeric default 0,
  p_budget_breakdown jsonb default null,
  p_created_by uuid default null,
  p_deliverables jsonb default '[]',
  p_shots jsonb default '[]'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'shoot'
as $$
DECLARE
  v_shoot_id uuid;
  v_item     jsonb;
BEGIN
  IF p_created_by IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.brands b
    WHERE b.id = p_brand_id
      AND (
        (b.org_id IS NULL AND b.user_id = p_created_by)
        OR (b.org_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.org_members m
          WHERE m.org_id = b.org_id
            AND m.user_id = p_created_by
            AND m.role IN ('owner', 'editor')
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
$$;

-- create or replace preserves existing grants, but reassert explicitly so
-- this migration is self-verifying regardless of prior grant state.
revoke all on function public.commit_shoot_draft(
  uuid, text, text, text[], numeric, jsonb, uuid, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.commit_shoot_draft(
  uuid, text, text, text[], numeric, jsonb, uuid, jsonb, jsonb
) to service_role, postgres;

-- Rollback (manual, if ever needed): re-apply the IPI-727 function body from
-- supabase/migrations/20260720055255_ipi727_commit_shoot_draft_authz.sql via
-- another forward `create or replace function` migration.

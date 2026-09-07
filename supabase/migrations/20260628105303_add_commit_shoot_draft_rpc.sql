-- IPI-150 / shoot wizard — atomic commit RPC (initial; channel cast fix in 20260628105606)
-- Rollback: DROP FUNCTION IF EXISTS public.commit_shoot_draft(uuid, text, text, text[], numeric, jsonb, uuid, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.commit_shoot_draft(
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
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, shoot
AS $function$
DECLARE
  v_shoot_id uuid;
  v_item     jsonb;
BEGIN
  INSERT INTO shoot.shoots (
    brand_id, name, type, brief,
    target_channels, estimated_budget, budget_breakdown,
    created_by, status
  ) VALUES (
    p_brand_id, p_name, 'studio_ecommerce', p_brief,
    p_target_channels,
    p_estimated_budget, p_budget_breakdown,
    p_created_by, 'planning'
  )
  RETURNING id INTO v_shoot_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_deliverables)
  LOOP
    INSERT INTO shoot.shoot_deliverables (shoot_id, channel, format, quantity, origin)
    VALUES (
      v_shoot_id,
      v_item->>'channel',
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

REVOKE ALL ON FUNCTION public.commit_shoot_draft(
  uuid, text, text, text[], numeric, jsonb, uuid, jsonb, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_shoot_draft(
  uuid, text, text, text[], numeric, jsonb, uuid, jsonb, jsonb
) TO service_role;

-- IPI-367 follow-up · post-implementation Supabase schema audit hardening
-- (Universal-design-prompt-4/tasks/AUDIT/crm-supa-audit.md)
--
-- Three real gaps found and closed in this pass, all inside crm_convert_deal:
--
-- 1. Authorization was is_org_member (any org_members row — including role
--    'viewer', confirmed live: org_members.role check constraint is exactly
--    ('owner','editor','viewer')). A viewer could trigger the single most
--    irreversible write in the CRM module. Upgraded to
--    is_org_editor_or_above (role IN ('owner','editor')), which already
--    existed live and was simply never considered when this function was
--    first written.
-- 2. No crm_activities row was written on conversion — the Deal Detail page
--    already renders ActivityTimeline for this deal_id, so the conversion
--    was invisible in the one place an operator would look for it. `type`
--    has no dedicated system-event value (CHECK is note/call/email/meeting/
--    task/ai_summary) — 'note' is the closest honest fit; created_by
--    carries the actor, so the body text only needs to describe what
--    changed, not who did it.
-- 3. crm_companies.domain was never copied into the new brand's brand_url —
--    silently dropped known data on every conversion that creates a brand.
--    Only set when domain is non-null/non-blank ("when valid" — no further
--    URL-format validation added; brand_url is free text everywhere else
--    in this app too).

create or replace function public.crm_convert_deal(
  p_deal_id uuid,
  p_decision text
)
returns table (deal_id uuid, stage text, brand_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_company_id uuid;
  v_current_stage text;
  v_existing_brand_id uuid;
  v_company_name text;
  v_company_domain text;
  v_result_brand_id uuid;
  v_brand_created boolean := false;
begin
  if p_decision not in ('won', 'lost') then
    raise exception 'crm_convert_deal: decision must be won or lost';
  end if;

  select org_id, company_id, stage
    into v_org_id, v_company_id, v_current_stage
    from public.crm_deals
    where id = p_deal_id
    for update;

  if v_org_id is null then
    raise exception 'crm_convert_deal: deal not found';
  end if;

  if not public.is_org_editor_or_above(v_org_id) then
    raise exception 'crm_convert_deal: caller must be an org editor or owner';
  end if;

  if v_current_stage in ('won', 'lost') then
    raise exception 'crm_convert_deal: deal % is already terminal (%)', p_deal_id, v_current_stage;
  end if;

  perform set_config('app.crm_convert', '1', true);

  if p_decision = 'won' then
    select brand_id, name, domain into v_existing_brand_id, v_company_name, v_company_domain
      from public.crm_companies
      where id = v_company_id and org_id = v_org_id
      for update;

    if v_existing_brand_id is null then
      insert into public.brands (user_id, org_id, name, brand_url)
      values (
        (select auth.uid()),
        v_org_id,
        coalesce(v_company_name, 'Untitled brand'),
        nullif(trim(v_company_domain), '')
      )
      returning id into v_result_brand_id;
      v_brand_created := true;

      update public.crm_companies
        set brand_id = v_result_brand_id
        where id = v_company_id and org_id = v_org_id;
    else
      v_result_brand_id := v_existing_brand_id;
    end if;
  end if;

  update public.crm_deals
    set stage = p_decision, closed_at = now()
    where id = p_deal_id and org_id = v_org_id;

  insert into public.crm_activities (org_id, deal_id, company_id, type, body, created_by)
  values (
    v_org_id,
    p_deal_id,
    v_company_id,
    'note',
    case
      when p_decision = 'won' and v_brand_created then
        format('Deal marked won (was %s). New brand created and linked.', v_current_stage)
      when p_decision = 'won' then
        format('Deal marked won (was %s). Linked to existing brand.', v_current_stage)
      else
        format('Deal marked lost (was %s).', v_current_stage)
    end,
    (select auth.uid())
  );

  return query select p_deal_id, p_decision, v_result_brand_id;
end;
$$;

comment on function public.crm_convert_deal(uuid, text) is
  'IPI-367 — the only function allowed to set crm_deals.stage=won/lost. Requires is_org_editor_or_above() (tightened 2026-07-12 — is_org_member admits viewers). On won, creates or links a brands row (user_id = the approving operator, brand_url copied from crm_companies.domain when present) and sets crm_companies.brand_id. Writes a crm_activities audit row in the same transaction. Called exclusively by POST /api/crm/deals/[id]/convert.';

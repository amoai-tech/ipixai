-- IPI-367 follow-up fix · the RETURNS TABLE column names (deal_id/stage/brand_id)
-- shadow bare column references of the same name inside the function body —
-- "column reference is ambiguous". Qualify with the source table name.
-- Found by actually executing the function via verify-rls.mjs (2026-07-12);
-- crm_convert_deal had never successfully completed a real call before this.

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

  select crm_deals.org_id, crm_deals.company_id, crm_deals.stage
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
    select crm_companies.brand_id, crm_companies.name, crm_companies.domain
      into v_existing_brand_id, v_company_name, v_company_domain
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

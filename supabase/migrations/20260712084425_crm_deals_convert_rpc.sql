-- IPI-367 · CRM-AI-001 — Won/Lost HITL gate + brand conversion RPC
-- The only path allowed to set crm_deals.stage = won/lost. Wraps the stage
-- write and the brands create/link in one transaction via the existing
-- app.crm_convert session flag (IPI-362's crm_deals_guard_terminal_stage()
-- trigger, hardened 20260704103223) — this function is now that trigger's
-- one legitimate caller.
--
-- Org scoping is resolved server-side from the deal row + is_org_member(),
-- never trusted from a client-supplied org_id parameter.
--
-- brands is keyed by user_id, not org_id (see 20260614000000_ipix_platform_mvp.sql)
-- — an older, per-operator ownership model that predates the org-scoped CRM
-- layer. The new/linked brand's user_id is the approving operator (auth.uid()),
-- since there is no other real owner to attribute it to. Flagged explicitly
-- for rls-policy-auditor + migration-reviewer sign-off per IPI-367's mandate —
-- this is the one architectural judgment call in this migration, not a fact
-- pulled from an existing convention.

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
  v_result_brand_id uuid;
begin
  if p_decision not in ('won', 'lost') then
    raise exception 'crm_convert_deal: decision must be won or lost';
  end if;

  -- Locked for the duration of the transaction — two concurrent converts on
  -- the same deal (or two deals on the same company) must not both read a
  -- stale pre-conversion stage/brand_id and each create their own brands
  -- row. Reviewed and required by the 2026-07-12 migration-safety pass.
  select org_id, company_id, stage
    into v_org_id, v_company_id, v_current_stage
    from public.crm_deals
    where id = p_deal_id
    for update;

  if v_org_id is null then
    raise exception 'crm_convert_deal: deal not found';
  end if;

  if not public.is_org_member(v_org_id) then
    raise exception 'crm_convert_deal: caller is not a member of this deal''s organization';
  end if;

  if v_current_stage in ('won', 'lost') then
    raise exception 'crm_convert_deal: deal % is already terminal (%)', p_deal_id, v_current_stage;
  end if;

  -- Same-transaction flag the guard trigger requires — set just before the
  -- one UPDATE that's allowed to cross into won/lost.
  perform set_config('app.crm_convert', '1', true);

  if p_decision = 'won' then
    -- Also locked (see the deal-row lock above) — same concurrent-convert
    -- race, this time on the company's brand_id.
    select brand_id, name into v_existing_brand_id, v_company_name
      from public.crm_companies
      where id = v_company_id and org_id = v_org_id
      for update;

    if v_existing_brand_id is null then
      -- brands.org_id is NOT NULL (20260624000000_ipi16_org_layer.sql step 6)
      -- — omitting it was caught by migration-safety review before this ever
      -- reached the remote project; every won-conversion would have raised a
      -- not-null violation without this.
      insert into public.brands (user_id, org_id, name)
      values ((select auth.uid()), v_org_id, coalesce(v_company_name, 'Untitled brand'))
      returning id into v_result_brand_id;

      update public.crm_companies
        set brand_id = v_result_brand_id
        where id = v_company_id and org_id = v_org_id;
    else
      -- Already linked (e.g. a prior won deal for the same company) — reuse
      -- it, never create a second brands row for one crm_companies record.
      v_result_brand_id := v_existing_brand_id;
    end if;
  end if;

  update public.crm_deals
    set stage = p_decision, closed_at = now()
    where id = p_deal_id and org_id = v_org_id;

  return query select p_deal_id, p_decision, v_result_brand_id;
end;
$$;

comment on function public.crm_convert_deal(uuid, text) is
  'IPI-367 — the only function allowed to set crm_deals.stage=won/lost. Org membership checked via is_org_member(); on won, creates or links a brands row (user_id = the approving operator via auth.uid()) and sets crm_companies.brand_id. Called exclusively by POST /api/crm/deals/[id]/convert.';

-- Same revoke/grant convention as crm_deals_guard_terminal_stage()
-- (20260704103223) — explicit allow-list, not default PostgREST exposure.
revoke all on function public.crm_convert_deal(uuid, text) from public;
revoke all on function public.crm_convert_deal(uuid, text) from anon;
grant execute on function public.crm_convert_deal(uuid, text) to authenticated;

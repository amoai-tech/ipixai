-- IPI-1119 · MEDIA-APPROVAL-001 — Approve or Reject the Exact Cloudinary Asset Version
--
-- This migration contains THREE additive changes:
--
--   1. apply_cloudinary_asset_event(jsonb) — one-line invariant fix:
--      when a STRICTLY NEWER provider version is applied to an existing mirror
--      row, the convenience `cloudinary_assets.approval` is reset to 'pending'
--      in the SAME transaction that advances `version`. Same-version
--      rename/retry preserves the current approval; a stale older event still
--      returns 'noop_stale' and changes nothing. Without this, an overwrite
--      (Cloudinary version N+1) would silently inherit the approval decision
--      recorded for version N.
--      The body below is the current live definition from
--      20260905094610_ipi1111-schema-version-guard.sql with that single change.
--
--   2. decide_asset_version(...) — new atomic authenticated RPC that records a
--      human approved/rejected decision for ONE exact
--      (cloudinary_asset_id, version) in public.asset_events and mirrors it to
--      cloudinary_assets.approval in the same transaction. Reuses the hardened
--      Brand Intelligence approve/reject pattern (auth.uid() -> resolve
--      asset->brand->org -> is_org_editor_or_above -> FOR UPDATE -> exact
--      identity check -> idempotency/final-decision invariant -> atomic write).
--      Authenticated-only; service_role must not inherit human approval.
--
--   3. get_shoot_detail(uuid) — additive read contract: each asset now exposes
--      immutable `cloudinary_asset_id`, exact `version`, and convenience
--      `approval`. Preserves every field/behavior from
--      20260914215600_ipi1138_get_shoot_detail_deliverable_fields.sql.
--
-- Rollback:
--   drop function public.decide_asset_version(uuid,text,bigint,text,text,text);
--   -- re-apply 20260905094610 (apply fn) and 20260914215600 (get_shoot_detail)

-- ===========================================================================
-- 1. apply_cloudinary_asset_event — newer version resets approval to pending
-- ===========================================================================
create or replace function public.apply_cloudinary_asset_event(p_event jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'shoot'
as $$
declare
  v_kind text := coalesce(p_event->>'kind', '');
  v_provider_id text := nullif(p_event->>'cloudinary_asset_id', '');
  v_version bigint := nullif(p_event->>'version', '')::bigint;
  v_public_id text := nullif(p_event->>'public_id', '');
  v_secure_url text := nullif(p_event->>'secure_url', '');
  v_resource_type text := nullif(p_event->>'resource_type', '');
  v_delivery_type text := nullif(p_event->>'delivery_type', '');
  v_width int := nullif(p_event->>'width', '')::int;
  v_height int := nullif(p_event->>'height', '')::int;
  v_bytes bigint := nullif(p_event->>'bytes', '')::bigint;
  v_format text := nullif(p_event->>'format', '');
  v_folder text := nullif(p_event->>'folder', '');
  v_request_id text := nullif(p_event->>'request_id', '');
  v_internal_asset_id uuid := coalesce(
    nullif(p_event->>'asset_id', ''),
    nullif(p_event->>'ipix_asset_id', '')
  )::uuid;
  v_brand_id uuid := nullif(p_event->>'brand_id', '')::uuid;
  v_org_id uuid := nullif(p_event->>'org_id', '')::uuid;
  v_v2_shoot_id uuid := nullif(p_event->>'v2_shoot_id', '')::uuid;
  v_asset_type public.asset_type;
  v_mime text;
  v_row public.cloudinary_assets%rowtype;
  v_asset_id uuid;
  v_event_kind text;
  v_inserted int := 0;
  v_effective_resource text;
  v_effective_delivery text;
  v_schema_version text := coalesce(p_event->>'schema_version', '');
begin
  if v_kind not in ('upload', 'overwrite', 'rename', 'deleted') then
    return jsonb_build_object('outcome', 'noop_ignored_kind', 'kind', v_kind);
  end if;

  if v_request_id is null then
    return jsonb_build_object('outcome', 'noop_missing_request_id');
  end if;

  if v_delivery_type is not null
     and v_delivery_type not in ('upload', 'authenticated', 'private') then
    v_delivery_type := 'authenticated';
  end if;

  ---------------------------------------------------------------------------
  -- DELETE / ARCHIVE
  ---------------------------------------------------------------------------
  if v_kind = 'deleted' then
    if v_provider_id is not null then
      select * into v_row
      from public.cloudinary_assets
      where cloudinary_asset_id = v_provider_id
      for update;
    elsif v_public_id is not null then
      select * into v_row
      from public.cloudinary_assets
      where public_id = v_public_id
      for update;
    end if;

    if not found then
      return jsonb_build_object(
        'outcome', 'noop_delete_unknown',
        'cloudinary_asset_id', v_provider_id,
        'public_id', v_public_id
      );
    end if;

    -- Same newest-version guard as upload.
    if v_version is not null
       and v_row.version is not null
       and v_version < v_row.version then
      return jsonb_build_object(
        'outcome', 'noop_stale',
        'asset_id', v_row.asset_id,
        'cloudinary_asset_id', coalesce(v_provider_id, v_row.cloudinary_asset_id),
        'version', v_row.version,
        'ignored_version', v_version
      );
    end if;

    v_asset_id := v_row.asset_id;

    -- Idempotency before mutate.
    insert into public.asset_events (
      asset_id, cloudinary_asset_id, version, kind, request_id, metadata
    )
    values (
      v_asset_id,
      coalesce(v_provider_id, v_row.cloudinary_asset_id),
      coalesce(v_version, v_row.version),
      'deleted',
      v_request_id,
      jsonb_build_object(
        'source', 'cloudinary_webhook',
        'public_id', coalesce(v_public_id, v_row.public_id)
      )
    )
    on conflict (request_id, asset_id) where (request_id is not null)
    do nothing;

    get diagnostics v_inserted = row_count;
    if v_inserted = 0 then
      return jsonb_build_object(
        'outcome', 'noop_duplicate_delete',
        'asset_id', v_asset_id,
        'cloudinary_asset_id', coalesce(v_provider_id, v_row.cloudinary_asset_id),
        'version', coalesce(v_version, v_row.version)
      );
    end if;

    update public.cloudinary_assets
    set
      status = 'archived',
      updated_at = now(),
      cloudinary_asset_id = coalesce(cloudinary_asset_id, v_provider_id),
      version = coalesce(v_version, version)
    where id = v_row.id;

    return jsonb_build_object(
      'outcome', 'archived',
      'asset_id', v_asset_id,
      'cloudinary_asset_id', coalesce(v_provider_id, v_row.cloudinary_asset_id),
      'version', coalesce(v_version, v_row.version)
    );
  end if;

  ---------------------------------------------------------------------------
  -- UPLOAD / OVERWRITE / RENAME
  ---------------------------------------------------------------------------
  if v_provider_id is null then
    return jsonb_build_object('outcome', 'noop_missing_provider_id');
  end if;

  -- Serialize concurrent first-seen events for the same provider id.
  perform pg_advisory_xact_lock(hashtext('cld:' || v_provider_id));

  select * into v_row
  from public.cloudinary_assets
  where cloudinary_asset_id = v_provider_id
  for update;

  v_event_kind := case
    when v_kind = 'overwrite' then 'overwrite'
    when v_kind = 'rename' then 'rename'
    else 'upload'
  end;

  if found then
    v_asset_id := v_row.asset_id;

    if v_version is not null and v_row.version is not null then
      if v_version < v_row.version then
        return jsonb_build_object(
          'outcome', 'noop_stale',
          'asset_id', v_asset_id,
          'cloudinary_asset_id', v_provider_id,
          'version', v_row.version,
          'ignored_version', v_version
        );
      end if;

      -- Equal version: never mutate (blocks resurrect-after-delete on retry).
      if v_version = v_row.version then
        insert into public.asset_events (
          asset_id, cloudinary_asset_id, version, kind, request_id, metadata
        )
        values (
          v_asset_id, v_provider_id, v_version, v_event_kind, v_request_id,
          jsonb_build_object(
            'source', 'cloudinary_webhook',
            'public_id', coalesce(v_public_id, v_row.public_id),
            'notification_kind', v_kind,
            'equal_version', true
          )
        )
        on conflict (request_id, asset_id) where (request_id is not null)
        do nothing;

        get diagnostics v_inserted = row_count;
        return jsonb_build_object(
          'outcome', case when v_inserted = 0 then 'noop_duplicate' else 'noop_equal_version' end,
          'asset_id', v_asset_id,
          'cloudinary_asset_id', v_provider_id,
          'version', v_row.version
        );
      end if;
    end if;

    -- Idempotency before mutate (version > stored, or either side null).
    insert into public.asset_events (
      asset_id, cloudinary_asset_id, version, kind, request_id, metadata
    )
    values (
      v_asset_id, v_provider_id, v_version, v_event_kind, v_request_id,
      jsonb_build_object(
        'source', 'cloudinary_webhook',
        'public_id', coalesce(v_public_id, v_row.public_id),
        'notification_kind', v_kind
      )
    )
    on conflict (request_id, asset_id) where (request_id is not null)
    do nothing;

    get diagnostics v_inserted = row_count;
    if v_inserted = 0 then
      return jsonb_build_object(
        'outcome', 'noop_duplicate',
        'asset_id', v_asset_id,
        'cloudinary_asset_id', v_provider_id,
        'version', coalesce(v_version, v_row.version)
      );
    end if;

    update public.cloudinary_assets
    set
      public_id = coalesce(v_public_id, public_id),
      secure_url = coalesce(v_secure_url, secure_url),
      resource_type = coalesce(v_resource_type, resource_type),
      delivery_type = coalesce(v_delivery_type, delivery_type),
      version = coalesce(v_version, version),
      width = coalesce(v_width, width),
      height = coalesce(v_height, height),
      bytes = coalesce(v_bytes, bytes),
      format = coalesce(v_format, format),
      folder = coalesce(v_folder, folder),
      status = 'ready',
      -- IPI-1119: a STRICTLY NEWER provider version invalidates the prior
      -- approval decision; the new version goes back to 'pending' and must be
      -- reviewed again. Same-version rename/retry never reaches here (it
      -- returns noop_equal_version above), and an event with an unknown
      -- version on either side cannot prove "newer", so approval is preserved.
      approval = case
        when v_version is not null
          and v_row.version is not null
          and v_version > v_row.version then 'pending'
        else approval
      end,
      updated_at = now(),
      -- Merge org_id only when the event supplies it (null must not wipe stored org).
      metadata = metadata
        || jsonb_build_object('last_webhook_kind', v_kind)
        || case
             when v_org_id is not null then jsonb_build_object('org_id', v_org_id)
             else '{}'::jsonb
           end
    where id = v_row.id;

    -- Provider delivery fields only — brand_id / org / v2_shoot_id stay put.
    update public.assets
    set
      cloudinary_public_id = coalesce(v_public_id, cloudinary_public_id),
      url = coalesce(v_secure_url, url),
      width = coalesce(v_width, width),
      height = coalesce(v_height, height),
      file_size = coalesce(v_bytes, file_size),
      updated_at = now()
    where id = v_asset_id;

    return jsonb_build_object(
      'outcome', 'applied',
      'asset_id', v_asset_id,
      'cloudinary_asset_id', v_provider_id,
      'version', v_version
    );
  end if;

  -- New provider asset — identity from signed upload context.
  --
  -- IPI-1111 · CLD-WEBHOOK-001: first-seen assets must carry schema_version=1
  -- and a trusted full context (internal_asset_id + brand_id + org_id with
  -- brand.org_id == org_id). Existing-asset paths (overwrite/rename/delete)
  -- skip this to preserve idempotency / retroactive-webhook safety.
  --
  -- We are in the first-seen path (the `if found then ... end if;` block above
  -- handles existing assets and returns). Do NOT rely on PL/pgSQL FOUND here:
  -- the brand-existence query below would have overwritten it. The schema-version
  -- guard runs first so a first-seen event missing the trusted V2 context
  -- short-circuits deterministically ahead of any tenant-identity validation.
  if v_schema_version != '1' then
    return jsonb_build_object(
      'outcome', 'noop_missing_schema_version',
      'cloudinary_asset_id', v_provider_id
    );
  end if;

  if v_internal_asset_id is null then
    return jsonb_build_object(
      'outcome', 'noop_missing_asset_id',
      'cloudinary_asset_id', v_provider_id
    );
  end if;

  if v_brand_id is null then
    return jsonb_build_object(
      'outcome', 'noop_missing_brand_id',
      'cloudinary_asset_id', v_provider_id,
      'asset_id', v_internal_asset_id
    );
  end if;

  if v_public_id is null or v_secure_url is null then
    return jsonb_build_object(
      'outcome', 'noop_missing_delivery_fields',
      'cloudinary_asset_id', v_provider_id
    );
  end if;

  if v_org_id is null then
    return jsonb_build_object(
      'outcome', 'noop_missing_org_id',
      'cloudinary_asset_id', v_provider_id,
      'asset_id', v_internal_asset_id
    );
  end if;

  -- Brand must exist and belong to the supplied org.
  if not exists (
    select 1 from public.brands b
    where b.id = v_brand_id and b.org_id = v_org_id
  ) then
    return jsonb_build_object(
      'outcome', 'noop_unknown_brand',
      'brand_id', v_brand_id,
      'org_id', v_org_id
    );
  end if;

  v_effective_resource := coalesce(v_resource_type, 'image');
  v_effective_delivery := coalesce(v_delivery_type, 'authenticated');
  if v_effective_delivery not in ('upload', 'authenticated', 'private') then
    v_effective_delivery := 'authenticated';
  end if;

  v_asset_type := case
    when v_effective_resource = 'video' then 'video'::public.asset_type
    when v_effective_resource in ('raw', 'document') then 'document'::public.asset_type
    else 'image'::public.asset_type
  end;

  v_mime := case
    when v_format is null then null
    when v_effective_resource = 'video' then 'video/' || v_format
    when v_effective_resource in ('raw', 'document') then 'application/' || v_format
    else 'image/' || v_format
  end;

  insert into public.assets (
    id, brand_id, v2_shoot_id, url, asset_type, cloudinary_public_id,
    width, height, file_size, mime_type, status, metadata
  )
  values (
    v_internal_asset_id, v_brand_id, v_v2_shoot_id, v_secure_url, v_asset_type,
    v_public_id, v_width, v_height, v_bytes, v_mime, 'draft',
    jsonb_build_object('source', 'cloudinary_webhook', 'org_id', v_org_id)
  )
  on conflict (id) do update
  set
    -- Existing row: never retarget brand/org/shoot via webhook.
    url = excluded.url,
    cloudinary_public_id = excluded.cloudinary_public_id,
    width = coalesce(excluded.width, public.assets.width),
    height = coalesce(excluded.height, public.assets.height),
    file_size = coalesce(excluded.file_size, public.assets.file_size),
    mime_type = coalesce(excluded.mime_type, public.assets.mime_type),
    updated_at = now();

  v_asset_id := v_internal_asset_id;

  -- Idempotency before mirror insert.
  insert into public.asset_events (
    asset_id, cloudinary_asset_id, version, kind, request_id, metadata
  )
  values (
    v_asset_id, v_provider_id, v_version, v_event_kind, v_request_id,
    jsonb_build_object(
      'source', 'cloudinary_webhook',
      'public_id', v_public_id,
      'notification_kind', v_kind
    )
  )
  on conflict (request_id, asset_id) where (request_id is not null)
  do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return jsonb_build_object(
      'outcome', 'noop_duplicate',
      'asset_id', v_asset_id,
      'cloudinary_asset_id', v_provider_id,
      'version', v_version
    );
  end if;

  insert into public.cloudinary_assets (
    asset_id, cloudinary_asset_id, public_id, secure_url, resource_type,
    delivery_type, version, width, height, bytes, format, folder,
    status, approval, moderation_status, metadata
  )
  values (
    v_asset_id, v_provider_id, v_public_id, v_secure_url, v_effective_resource,
    v_effective_delivery, v_version, v_width, v_height, v_bytes, v_format, v_folder,
    'ready', 'pending', 'pending',
    jsonb_build_object(
      'source', 'cloudinary_webhook',
      'org_id', v_org_id,
      'last_webhook_kind', v_kind
    )
  );

  return jsonb_build_object(
    'outcome', 'applied',
    'asset_id', v_asset_id,
    'cloudinary_asset_id', v_provider_id,
    'version', v_version
  );
end;
$$;

comment on function public.apply_cloudinary_asset_event(jsonb) is
'IPI-1111/IPI-1119: single-event Cloudinary webhook state machine (idempotency-first, version guard). A strictly newer provider version resets cloudinary_assets.approval to pending in the same transaction. service_role only.';

-- ===========================================================================
-- 2. decide_asset_version — atomic exact-version human approval/rejection
-- ===========================================================================
-- Approval is a Supabase business decision, never a Cloudinary ACL operation.
-- Durable truth: public.asset_events (kind = approved|rejected, exact
-- cloudinary_asset_id + version + actor_id). cloudinary_assets.approval is a
-- convenience mirror only and must never be the sole delivery authorization.
--
-- Contract (see IPI-1119):
--   same request replay + same payload        -> ALREADY_APPROVED/ALREADY_REJECTED
--   same version + same final decision        -> ALREADY_APPROVED/ALREADY_REJECTED
--   same version + opposite decision          -> DECISION_FINALIZED (no write)
--   current version != reviewed version       -> STALE_VERSION (no write)
create or replace function public.decide_asset_version(
  p_asset_id uuid,
  p_expected_cloudinary_asset_id text,
  p_expected_version bigint,
  p_decision text,
  p_reason text,
  p_request_id text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_row public.cloudinary_assets%rowtype;
  v_existing_kind text;
  v_inserted int := 0;
  v_conflict_kind text;
  v_conflict_version bigint;
  v_conflict_provider text;
  v_success_code text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED');
  end if;

  if p_decision is null or p_decision not in ('approved', 'rejected') then
    return jsonb_build_object('ok', false, 'code', 'INVALID_DECISION');
  end if;

  if p_expected_cloudinary_asset_id is null
     or p_expected_version is null
     or p_request_id is null
     or btrim(p_request_id) = '' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_REQUEST');
  end if;

  -- resolve Asset -> Brand -> organization server-side (never trust caller org)
  select b.org_id into v_org_id
  from public.assets a
  join public.brands b on b.id = a.brand_id
  where a.id = p_asset_id;

  if v_org_id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  -- only editor/owner may make the human decision
  if not public.is_org_editor_or_above(v_org_id) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  -- lock the current mirror row: serializes concurrent decisions and races
  -- with a webhook that advances the version
  select * into v_row
  from public.cloudinary_assets
  where asset_id = p_asset_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NO_MIRROR');
  end if;

  -- the reviewed exact provider identity + version must still be current
  if v_row.cloudinary_asset_id is distinct from p_expected_cloudinary_asset_id
     or v_row.version is distinct from p_expected_version then
    return jsonb_build_object(
      'ok', false,
      'code', 'STALE_VERSION',
      'current_cloudinary_asset_id', v_row.cloudinary_asset_id,
      'current_version', v_row.version
    );
  end if;

  -- one exact (asset, provider id, version) has exactly one final decision
  select kind into v_existing_kind
  from public.asset_events
  where asset_id = p_asset_id
    and cloudinary_asset_id = p_expected_cloudinary_asset_id
    and version = p_expected_version
    and kind in ('approved', 'rejected')
  order by created_at desc
  limit 1;

  if v_existing_kind = p_decision then
    return jsonb_build_object(
      'ok', true,
      'code', case when p_decision = 'approved' then 'ALREADY_APPROVED' else 'ALREADY_REJECTED' end,
      'approval', p_decision,
      'level', 'convenience'
    );
  elsif v_existing_kind is not null then
    return jsonb_build_object(
      'ok', false, 'code', 'DECISION_FINALIZED', 'existing_decision', v_existing_kind
    );
  end if;

  -- durable exact-version audit event; request_id replay is idempotent
  insert into public.asset_events (
    asset_id, cloudinary_asset_id, version, kind, actor_id, reason, request_id, metadata
  )
  values (
    p_asset_id,
    p_expected_cloudinary_asset_id,
    p_expected_version,
    p_decision,
    auth.uid(),
    nullif(btrim(coalesce(p_reason, '')), ''),
    p_request_id,
    jsonb_build_object('source', 'operator_decision')
  )
  on conflict (request_id, asset_id) where (request_id is not null)
  do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    -- request_id already used for this asset: safe only when it recorded the
    -- identical exact-version decision; a reused id with a different payload
    -- must fail closed instead of being reported as success.
    select kind, version, cloudinary_asset_id
      into v_conflict_kind, v_conflict_version, v_conflict_provider
    from public.asset_events
    where request_id = p_request_id and asset_id = p_asset_id;

    if v_conflict_kind = p_decision
       and v_conflict_version = p_expected_version
       and v_conflict_provider = p_expected_cloudinary_asset_id then
      return jsonb_build_object(
        'ok', true,
        'code', case when p_decision = 'approved' then 'ALREADY_APPROVED' else 'ALREADY_REJECTED' end,
        'approval', p_decision
      );
    end if;

    return jsonb_build_object('ok', false, 'code', 'REQUEST_CONFLICT');
  end if;

  -- convenience state changes in the same transaction as the durable event
  update public.cloudinary_assets
  set approval = p_decision, updated_at = now()
  where id = v_row.id;

  return jsonb_build_object(
    'ok', true,
    'code', case when p_decision = 'approved' then 'APPROVED' else 'REJECTED' end,
    'approval', p_decision,
    'cloudinary_asset_id', p_expected_cloudinary_asset_id,
    'version', p_expected_version
  );
end;
$$;

comment on function public.decide_asset_version(uuid, text, bigint, text, text, text) is
'IPI-1119: atomic exact-version human approval/rejection. Records one final decision in public.asset_events for the exact (cloudinary_asset_id, version) and mirrors convenience approval. Authenticated editor/owner only; never touches Cloudinary ACL.';

-- Human approval must not be callable by anon or service_role. The
-- service_role default function ACL must be revoked explicitly (see
-- 20260909000000_ipi1093_brand_intel_approve_contract.sql).
revoke all on function public.decide_asset_version(uuid, text, bigint, text, text, text)
  from public, anon, service_role;
grant execute on function public.decide_asset_version(uuid, text, bigint, text, text, text)
  to authenticated;

-- DB-level backstop for the "one exact version has exactly one final human
-- decision" invariant. The RPC enforces this in PL/pgSQL, but a future or
-- alternative writer with service_role table access could otherwise insert a
-- contradictory approved+rejected pair for the same exact
-- (asset_id, cloudinary_asset_id, version). No current writer emits
-- approved/rejected rows other than decide_asset_version, so no backfill is
-- needed. Partial: only decision rows with a known exact provider version.
create unique index if not exists asset_events_one_decision_per_version_idx
  on public.asset_events (asset_id, cloudinary_asset_id, version)
  where kind in ('approved', 'rejected')
    and cloudinary_asset_id is not null
    and version is not null;

-- ===========================================================================
-- 3. get_shoot_detail — expose exact provider identity/version + approval
-- ===========================================================================
-- Body preserved from 20260914215600_ipi1138_get_shoot_detail_deliverable_fields.sql.
-- New per-asset fields: cloudinary_asset_id (immutable provider identity),
-- version (exact current provider version), approval (pending|approved|rejected
-- convenience state). cloudinary_id/public_id remain mutable addressing and are
-- kept separate.
create or replace function public.get_shoot_detail(p_shoot_id uuid)
returns json
language plpgsql
security definer
set search_path = shoot, public
as $$
declare
  v_result json;
  v_brand_id uuid;
begin
  if auth.uid() is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select s.brand_id
  into v_brand_id
  from shoot.shoots s
  inner join public.brands b on b.id = s.brand_id
  where s.id = p_shoot_id
    and public.is_org_member(b.org_id);

  if v_brand_id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select json_build_object(
    'shoot', (
      select json_build_object(
        'id', s.id,
        'name', s.name,
        'status', s.status::text,
        'brief', s.brief,
        'target_channels', coalesce(s.target_channels::text[], array[]::text[]),
        'estimated_budget', s.estimated_budget,
        'actual_cost', s.actual_cost,
        'currency', s.currency,
        'budget_breakdown', s.budget_breakdown,
        'start_date', s.start_date,
        'end_date', s.end_date,
        'location', s.location,
        'dna_score', s.dna_score,
        'mood_board_urls', coalesce(s.mood_board_urls, array[]::text[]),
        'cover_url', case
          when s.mood_board_urls is not null and cardinality(s.mood_board_urls) > 0
          then s.mood_board_urls[1]
          else null
        end,
        'created_at', s.created_at,
        'updated_at', s.updated_at,
        'brand_id', s.brand_id
      )
      from shoot.shoots s
      where s.id = p_shoot_id
    ),
    'brand', (
      select json_build_object('id', b.id, 'name', b.name)
      from public.brands b
      where b.id = v_brand_id
    ),
    'deliverables', coalesce((
      select json_agg(json_build_object(
        'id', d.id,
        'channel', d.channel::text,
        'format', d.format,
        'aspect_ratio', d.aspect_ratio,
        'origin', d.origin,
        'quantity', d.quantity,
        'status', d.status
      ) order by d.channel)
      from shoot.shoot_deliverables d
      where d.shoot_id = p_shoot_id
    ), '[]'::json),
    'shots', coalesce((
      select json_agg(json_build_object(
        'id', sl.id,
        'shot_number', sl."order",
        'description', sl.description,
        'style_notes', sl.style_notes,
        'status', sl.status::text
      ) order by sl."order")
      from shoot.shot_list sl
      where sl.shoot_id = p_shoot_id
    ), '[]'::json),
    'assets', coalesce((
      select json_agg(json_build_object(
        'id', a.id,
        'url', a.url,
        'cloudinary_id', coalesce(ca.public_id, a.cloudinary_public_id),
        'cloudinary_asset_id', ca.cloudinary_asset_id,
        'version', ca.version,
        'approval', ca.approval,
        'format', ca.format,
        'resource_type', ca.resource_type,
        'width', coalesce(ca.width, a.width),
        'height', coalesce(ca.height, a.height),
        'dna_score', a.dna_score,
        'status', a.status::text,
        'created_at', a.created_at
      ) order by a.created_at desc)
      from public.assets a
      left join public.cloudinary_assets ca on ca.asset_id = a.id
      where a.v2_shoot_id = p_shoot_id
        and a.brand_id = v_brand_id
    ), '[]'::json),
    'crew', coalesce((
      select json_agg(json_build_object(
        'id', c.id,
        'role', c.role::text,
        'confirmed', c.confirmed,
        'notes', c.notes,
        'internal_contact_id', c.internal_contact_id,
        'marketplace_vendor_id', c.marketplace_vendor_id
      ) order by c.role)
      from shoot.shoot_crew c
      where c.shoot_id = p_shoot_id
    ), '[]'::json),
    'approvals', coalesce((
      select json_agg(json_build_object(
        'id', d.id,
        'status', d.status,
        'created_at', d.created_at,
        'approved_at', d.approved_at,
        'rejected_at', d.rejected_at,
        'agent_run_id', d.agent_run_id
      ) order by d.created_at desc)
      from shoot.shoot_intake_drafts d
      where d.submitted_by = auth.uid()
        and d.brand_id = v_brand_id
        and (
          d.source_context->>'shoot_id' = p_shoot_id::text
          or d.draft_shoot->>'id' = p_shoot_id::text
        )
    ), '[]'::json),
    'activity', coalesce((
      select json_agg(json_build_object(
        'id', sub.id,
        'agent_name', sub.agent_name,
        'created_at', sub.created_at,
        'model', sub.model
      ) order by sub.created_at desc)
      from (
        select l.id, l.agent_name, l.created_at, l.model
        from public.ai_agent_logs l
        where l.brand_id = v_brand_id
          and (
            l.input->>'shoot_id' = p_shoot_id::text
            or l.output->>'shoot_id' = p_shoot_id::text
          )
        order by l.created_at desc
        limit 50
      ) sub
    ), '[]'::json)
  )
  into v_result;

  return v_result;
end;
$$;

comment on function public.get_shoot_detail(uuid) is
  'IPI-1118/1138/1119 — canonical V2 asset read via public.assets.v2_shoot_id. IPI-1119 adds immutable cloudinary_asset_id, exact version, and convenience approval per asset. Org-membership authorization preserved.';

revoke all on function public.get_shoot_detail(uuid) from public, anon, authenticated;
grant execute on function public.get_shoot_detail(uuid) to authenticated;
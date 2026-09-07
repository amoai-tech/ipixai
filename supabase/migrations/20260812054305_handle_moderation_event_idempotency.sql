-- IPI-639: harden idempotency + preserve moderation outcome
-- Fixes:
-- 1. Reject duplicate request_id BEFORE updating status (prevents regression on retry)
-- 2. Preserve moderation_status + moderation_kind in metadata (audit can distinguish approved vs rejected)
-- 3. Consistent search_path=public (was public,pg_temp in 54304)
-- 4. ON CONFLICT WHERE request_id IS NOT NULL (already correct, preserved)
-- 5. Grant before revoke to avoid transient inaccessible window + explicit note on NULL version handling

drop function if exists public.handle_moderation_event(text, bigint, text, text, text, text);

create function public.handle_moderation_event(
  p_cloudinary_asset_id text,
  p_version bigint,
  p_moderation_status text,
  p_request_id text,
  p_moderation_kind text,
  p_public_id text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asset_id uuid;
  v_version bigint;
  v_kind text;
  v_current_status text;
begin
  v_kind := 'moderated';

  -- SELECT exact asset/version FOR UPDATE
  -- When p_version IS NULL, we select by cloudinary_asset_id only.
  -- cloudinary_assets has UNIQUE index cloudinary_assets_cloudinary_asset_id_uidx WHERE cloudinary_asset_id IS NOT NULL,
  -- so at most one row exists per cloudinary_asset_id. Version is informational for audit, not for disambiguating multiple rows.
  -- This prevents unintended multi-row updates.
  if p_version is not null then
    select moderation_status, asset_id, version into v_current_status, v_asset_id, v_version
      from public.cloudinary_assets
      where cloudinary_asset_id = p_cloudinary_asset_id and version = p_version
      for update
      limit 1;
  else
    select moderation_status, asset_id, version into v_current_status, v_asset_id, v_version
      from public.cloudinary_assets
      where cloudinary_asset_id = p_cloudinary_asset_id
      for update
      limit 1;
  end if;

  if not found then
    return 'unchanged';
  end if;

  -- Reject duplicate request_id before mutating status
  if p_request_id is not null then
    if exists (select 1 from public.asset_events where request_id = p_request_id and asset_id = v_asset_id) then
      return 'unchanged';
    end if;
  end if;

  if v_current_status = p_moderation_status then
    return 'unchanged';
  end if;

  if p_version is not null then
    update public.cloudinary_assets set moderation_status = p_moderation_status where cloudinary_asset_id = p_cloudinary_asset_id and version = p_version;
  else
    update public.cloudinary_assets set moderation_status = p_moderation_status where cloudinary_asset_id = p_cloudinary_asset_id;
  end if;

  if not found then
    return 'unchanged';
  end if;

  if p_request_id is null then
    p_request_id := gen_random_uuid()::text;
  end if;

  insert into public.asset_events (asset_id, cloudinary_asset_id, version, kind, request_id, reason, metadata)
    values (v_asset_id, p_cloudinary_asset_id, coalesce(v_version, p_version), v_kind, p_request_id, p_moderation_kind, jsonb_build_object('public_id', p_public_id, 'moderation_status', p_moderation_status, 'moderation_kind', p_moderation_kind))
    on conflict (request_id, asset_id) where request_id is not null do nothing;

  return 'changed';
end;
$$;

-- Grant to service_role FIRST, then revoke from public/anon/authenticated to avoid transient inaccessible window during deployment.
-- New function has no grants by default (owner only), so granting service_role first ensures it is accessible immediately after creation.
grant execute on function public.handle_moderation_event(text, bigint, text, text, text, text) to service_role;
revoke all on function public.handle_moderation_event(text, bigint, text, text, text, text) from public, anon, authenticated;

comment on function public.handle_moderation_event is 'IPI-639 atomic: moderation_status update + asset_events moderated (provider, not business approval). Business approval uses separate asset_approvals with actorId.';

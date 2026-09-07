-- IPI-639 fix: atomic moderation, version-bound FOR UPDATE, same-status no-op, UUID after lock, returns void (remote ledger)

create or replace function public.handle_moderation_event(
  p_cloudinary_asset_id text,
  p_version bigint,
  p_moderation_status text,
  p_request_id text,
  p_moderation_kind text,
  p_public_id text
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_asset_id uuid;
  v_version bigint;
  v_kind text;
  v_current_status text;
begin
  v_kind := 'moderated';

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
    return;
  end if;

  if v_current_status = p_moderation_status then
    return;
  end if;

  if p_version is not null then
    update public.cloudinary_assets
      set moderation_status = p_moderation_status
      where cloudinary_asset_id = p_cloudinary_asset_id and version = p_version;
  else
    update public.cloudinary_assets
      set moderation_status = p_moderation_status
      where cloudinary_asset_id = p_cloudinary_asset_id;
  end if;

  if not found then
    return;
  end if;

  if p_request_id is null then
    p_request_id := gen_random_uuid()::text;
  end if;

  insert into public.asset_events (asset_id, cloudinary_asset_id, version, kind, request_id, reason, metadata)
    values (v_asset_id, p_cloudinary_asset_id, coalesce(v_version, p_version), v_kind, p_request_id, p_moderation_kind, jsonb_build_object('public_id', p_public_id))
    on conflict (request_id, asset_id) where request_id is not null do nothing;
end;
$$;

revoke all on function public.handle_moderation_event(text, bigint, text, text, text, text) from public, anon, authenticated;
grant execute on function public.handle_moderation_event(text, bigint, text, text, text, text) to service_role;

comment on function public.handle_moderation_event is 'IPI-639 atomic: moderation_status update + asset_events moderated (provider, not business approval). Business approval uses separate asset_approvals with actorId.';

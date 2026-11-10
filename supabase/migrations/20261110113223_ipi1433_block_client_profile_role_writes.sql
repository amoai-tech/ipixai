-- IPI-1433 · AUTHZ-PROFILE-001
-- Authenticated clients must never write public.profiles.role.
-- RLS protects which row is accessible; column grants protect what is editable.
-- Broad table grants override column restrictions, so revoke them first.
revoke insert, update on table public.profiles from PUBLIC, anon, authenticated;

-- Preserve all existing profile fields except privileged role. Legitimate
-- server-controlled role assignment uses the explicit service_role grant.
grant insert (
  id, email, full_name, avatar_url, phone, company_name,
  created_at, updated_at, auth_provider, provider_user_id,
  onboarding_status
) on table public.profiles to authenticated;

grant update (
  id, email, full_name, avatar_url, phone, company_name,
  created_at, updated_at, auth_provider, provider_user_id,
  onboarding_status
) on table public.profiles to authenticated;

-- role defaults to designer; direct client INSERT(role)/UPDATE(role) denied.

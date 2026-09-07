-- Security advisor ERROR fix: shoot_portfolio_view and shot_type_references_view
-- were SECURITY DEFINER, bypassing RLS on the underlying shoot.shoots,
-- public.brands, and shoot.shot_type_references tables. Both underlying
-- tables already have RLS enabled with policies matching the views' intended
-- access (owner-only shoots; open read for shot type references), and
-- `authenticated` already holds direct SELECT grants on them, so switching
-- to security_invoker is a drop-in fix with no access-pattern change.
ALTER VIEW public.shoot_portfolio_view SET (security_invoker = TRUE);
ALTER VIEW public.shot_type_references_view SET (security_invoker = TRUE);

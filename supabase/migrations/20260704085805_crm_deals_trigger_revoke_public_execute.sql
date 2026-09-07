-- IPI-362 follow-up: crm_deals_guard_terminal_stage() is a trigger function,
-- never meant to be called directly. Security advisor flagged it as callable
-- via /rest/v1/rpc/crm_deals_guard_terminal_stage by anon + authenticated.
-- Revoke direct execute — it still runs fine as a trigger (trigger invocation
-- doesn't go through the same privilege check as a direct RPC call).

revoke execute on function public.crm_deals_guard_terminal_stage() from anon;
revoke execute on function public.crm_deals_guard_terminal_stage() from authenticated;
revoke execute on function public.crm_deals_guard_terminal_stage() from public;
;

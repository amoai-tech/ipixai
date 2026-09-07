-- Phase 3: Medium Priority - RLS Policy Optimization Guide

begin;

-- Create a helper function to identify policies that need optimization
create or replace function public.identify_rls_policies_needing_optimization()
returns table (
  schemaname text,
  tablename text,
  policyname text,
  cmd text,
  definition text,
  recommendation text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select
    p.schemaname::text,
    p.tablename::text,
    p.policyname::text,
    p.cmd::text,
    pg_get_expr(p.qual, p.polrelid)::text as definition,
    case
      when pg_get_expr(p.qual, p.polrelid)::text like '%auth.uid()%'
        and pg_get_expr(p.qual, p.polrelid)::text not like '%(select auth.uid())%'
        then 'Replace auth.uid() with (select auth.uid())'
      when pg_get_expr(p.qual, p.polrelid)::text like '%auth.jwt()%'
        and pg_get_expr(p.qual, p.polrelid)::text not like '%(select auth.jwt())%'
        then 'Replace auth.jwt() with (select auth.jwt())'
      else 'No optimization needed'
    end as recommendation
  from pg_policies p
  where p.schemaname = 'public'
    and (
      pg_get_expr(p.qual, p.polrelid)::text like '%auth.uid()%'
      or pg_get_expr(p.qual, p.polrelid)::text like '%auth.jwt()%'
    )
    and (
      pg_get_expr(p.qual, p.polrelid)::text not like '%(select auth.uid())%'
      or pg_get_expr(p.qual, p.polrelid)::text not like '%(select auth.jwt())%'
    )
  order by p.tablename, p.policyname;
end;
$$;

comment on function public.identify_rls_policies_needing_optimization() is
'Helper function to identify RLS policies that need auth.uid()/auth.jwt() optimization (Phase 3 audit fix)';

commit;;

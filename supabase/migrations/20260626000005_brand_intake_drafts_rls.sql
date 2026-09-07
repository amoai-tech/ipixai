-- IPI-26 — align brand_intake_drafts RLS with org ownership (table pre-exists on remote)
-- IPI-614: added create table — table was created OOB on remote, never in migration chain.
-- This must run before RLS policies below.

create table if not exists public.brand_intake_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  brand_id uuid references public.brands (id) on delete set null,
  source_url text not null,
  status text not null default 'pending',
  draft_profile jsonb not null default '{}'::jsonb,
  draft_scores jsonb not null default '[]'::jsonb,
  url_retrieval jsonb not null default '{}'::jsonb,
  citations jsonb not null default '[]'::jsonb,
  approved_at timestamptz,
  rejected_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists brand_intake_drafts_user_id_idx
  on public.brand_intake_drafts (user_id);

create index if not exists brand_intake_drafts_pending_user_updated_idx
  on public.brand_intake_drafts (user_id, status, updated_at desc)
  where status in ('pending', 'pending_approval');

-- Unique constraint has been moved to its own guarded migration
-- 20260715000000_add_brand_intake_drafts_unique_brand_id.sql.

alter table public.brand_intake_drafts enable row level security;

drop policy if exists "brand_intake_drafts_select_own" on public.brand_intake_drafts;
drop policy if exists "intake_drafts_select_own" on public.brand_intake_drafts;
drop policy if exists "brand_intake_drafts_select" on public.brand_intake_drafts;
drop policy if exists "intake_drafts_select_org_or_owner" on public.brand_intake_drafts;

create policy "intake_drafts_select_org_or_owner"
  on public.brand_intake_drafts for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      brand_id is not null
      and exists (
        select 1 from public.brands b
        where b.id = brand_intake_drafts.brand_id
          and public.is_org_member(b.org_id)
      )
    )
  );

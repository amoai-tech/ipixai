-- IPI-26 — brand_competitors (competitor intelligence output)

create table if not exists public.brand_competitors (
  id               uuid primary key default gen_random_uuid(),
  brand_id         uuid not null references public.brands(id) on delete cascade,
  name             text not null,
  url              text,
  category         text,
  price_point      text,
  scores           jsonb not null default '{}',
  strengths        jsonb not null default '[]',
  weaknesses       jsonb not null default '[]',
  social_presence  jsonb not null default '[]',
  unique_angles    jsonb not null default '[]',
  threat_level     text check (threat_level in ('low', 'medium', 'high')),
  profile_jsonb    jsonb not null default '{}',
  last_analyzed_at timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists brand_competitors_brand_id_idx
  on public.brand_competitors (brand_id);

alter table public.brand_competitors enable row level security;

drop policy if exists "competitors_select_org_member" on public.brand_competitors;

create policy "competitors_select_org_member"
  on public.brand_competitors for select to authenticated
  using (
    exists (
      select 1 from public.brands b
      where b.id = brand_competitors.brand_id
        and public.is_org_member(b.org_id)
    )
  );

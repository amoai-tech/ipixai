-- IPI-26 — brand_social_channels (social discovery output)

create table if not exists public.brand_social_channels (
  id                uuid primary key default gen_random_uuid(),
  brand_id          uuid not null references public.brands(id) on delete cascade,
  platform          text not null
    check (platform in ('instagram', 'tiktok', 'youtube', 'pinterest', 'linkedin', 'facebook', 'x')),
  url               text,
  handle            text,
  verified          boolean not null default false,
  bio               text,
  follower_signal   text,
  posting_frequency text,
  content_themes    jsonb not null default '[]',
  discovered_at     timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  unique (brand_id, platform)
);

create index if not exists brand_social_channels_brand_id_idx
  on public.brand_social_channels (brand_id);

comment on table public.brand_social_channels is
  'Social channels discovered by social-discovery agent. Service-role writes only.';

alter table public.brand_social_channels enable row level security;

drop policy if exists "social_channels_select_org_member" on public.brand_social_channels;

create policy "social_channels_select_org_member"
  on public.brand_social_channels for select to authenticated
  using (
    exists (
      select 1 from public.brands b
      where b.id = brand_social_channels.brand_id
        and public.is_org_member(b.org_id)
    )
  );

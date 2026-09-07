-- iPix platform MVP (PLT-001): brand intelligence + Mercur link layer
-- Commerce catalog stays on Mercur; this is memory / operator layer only.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- brands (iPix operator brand profiles — distinct from fashion_brands events UI)
-- ---------------------------------------------------------------------------
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  brand_url text,
  ai_profile jsonb not null default '{}'::jsonb,
  creative_temperature_default numeric(3, 2) not null default 0.50
    check (creative_temperature_default >= 0 and creative_temperature_default <= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists brands_user_id_idx on public.brands (user_id);

-- ---------------------------------------------------------------------------
-- brand_scores (DNA readiness from URL / asset analysis)
-- ---------------------------------------------------------------------------
create table if not exists public.brand_scores (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  score_type text not null,
  score numeric(5, 2) not null check (score >= 0 and score <= 100),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists brand_scores_brand_id_idx on public.brand_scores (brand_id);

-- ---------------------------------------------------------------------------
-- assets — extend existing shoot assets for iPix DNA gate
-- ---------------------------------------------------------------------------
alter table public.assets
  add column if not exists brand_id uuid references public.brands (id) on delete set null,
  add column if not exists dna_score numeric(5, 2)
    check (dna_score is null or (dna_score >= 0 and dna_score <= 100)),
  add column if not exists dna_status text
    check (dna_status is null or dna_status in ('approved', 'review', 'blocked')),
  add column if not exists dna_pillars jsonb not null default '{}'::jsonb;

create index if not exists assets_brand_id_idx on public.assets (brand_id);

-- ---------------------------------------------------------------------------
-- commerce_product_links (Supabase ↔ Mercur product.id)
-- ---------------------------------------------------------------------------
create table if not exists public.commerce_product_links (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  medusa_product_id text not null,
  asset_id uuid references public.assets (id) on delete set null,
  shoot_id uuid references public.shoots (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, medusa_product_id)
);

create index if not exists commerce_product_links_medusa_idx
  on public.commerce_product_links (medusa_product_id);

-- ---------------------------------------------------------------------------
-- ai_agent_logs
-- ---------------------------------------------------------------------------
create table if not exists public.ai_agent_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  brand_id uuid references public.brands (id) on delete set null,
  agent_name text not null,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  model text,
  tokens_in integer,
  tokens_out integer,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists ai_agent_logs_brand_id_idx on public.ai_agent_logs (brand_id);
create index if not exists ai_agent_logs_created_at_idx on public.ai_agent_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists brands_set_updated_at on public.brands;
create trigger brands_set_updated_at
  before update on public.brands
  for each row execute function public.set_updated_at();

drop trigger if exists commerce_product_links_set_updated_at on public.commerce_product_links;
create trigger commerce_product_links_set_updated_at
  before update on public.commerce_product_links
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.brands enable row level security;
alter table public.brand_scores enable row level security;
alter table public.commerce_product_links enable row level security;
alter table public.ai_agent_logs enable row level security;

create policy "brands_select_own"
  on public.brands for select to authenticated
  using (auth.uid() = user_id);

create policy "brands_insert_own"
  on public.brands for insert to authenticated
  with check (auth.uid() = user_id);

create policy "brands_update_own"
  on public.brands for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "brands_delete_own"
  on public.brands for delete to authenticated
  using (auth.uid() = user_id);

create policy "brand_scores_select_via_brand"
  on public.brand_scores for select to authenticated
  using (
    exists (
      select 1 from public.brands b
      where b.id = brand_scores.brand_id and b.user_id = auth.uid()
    )
  );

create policy "brand_scores_insert_via_brand"
  on public.brand_scores for insert to authenticated
  with check (
    exists (
      select 1 from public.brands b
      where b.id = brand_scores.brand_id and b.user_id = auth.uid()
    )
  );

create policy "commerce_product_links_select_via_brand"
  on public.commerce_product_links for select to authenticated
  using (
    exists (
      select 1 from public.brands b
      where b.id = commerce_product_links.brand_id and b.user_id = auth.uid()
    )
  );

create policy "commerce_product_links_insert_via_brand"
  on public.commerce_product_links for insert to authenticated
  with check (
    exists (
      select 1 from public.brands b
      where b.id = commerce_product_links.brand_id and b.user_id = auth.uid()
    )
  );

create policy "commerce_product_links_update_via_brand"
  on public.commerce_product_links for update to authenticated
  using (
    exists (
      select 1 from public.brands b
      where b.id = commerce_product_links.brand_id and b.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.brands b
      where b.id = commerce_product_links.brand_id and b.user_id = auth.uid()
    )
  );

create policy "commerce_product_links_delete_via_brand"
  on public.commerce_product_links for delete to authenticated
  using (
    exists (
      select 1 from public.brands b
      where b.id = commerce_product_links.brand_id and b.user_id = auth.uid()
    )
  );

create policy "ai_agent_logs_select_own"
  on public.ai_agent_logs for select to authenticated
  using (user_id is null or auth.uid() = user_id);

create policy "ai_agent_logs_insert_own"
  on public.ai_agent_logs for insert to authenticated
  with check (user_id is null or auth.uid() = user_id);

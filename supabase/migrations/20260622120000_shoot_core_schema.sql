-- ============================================================================
-- IPI2-117 · SHOOT-UX-008 — AI-native shoot CORE schema (Option A)
-- ============================================================================
-- Decision: SHOOT-PRE-001 (Option A — new brand_id-keyed tables; signed off PR #20).
--
-- Isolation: all new tables live in a dedicated `shoot` schema so they NEVER
-- collide with the legacy FashionOS public.shoots / public.shoot_assets, which
-- stay untouched (commerce_product_links.shoot_id FK and scripts/verify-rls.mjs
-- smoke check both keep working). No legacy table is altered or dropped.
--
-- Scope: CORE only — shoots, shoot_assets, shot_list, shoot_crew,
-- shoot_deliverables, shot_deliverable_links, shoot_intake_drafts.
-- (professional / scheduling / support / channel_specs tables are a follow-up.)
--
-- Ownership/RLS: brand ownership via public.brands.user_id = auth.uid().
-- No brand_users table. `(select auth.uid())` form for per-query caching.
--
-- Writes: durable tables expose SELECT to brand owners only — there are no
-- client INSERT/UPDATE/DELETE policies. All writes go through service-role edge
-- functions (IPI2-116), which bypass RLS. This enforces the no-silent-write rule.
--
-- Rollback / half-failed-push retry: this migration is purely additive and fully
-- namespaced, so teardown is a single safe statement with zero public blast
-- radius:  drop schema shoot cascade;  then re-apply. (DDL below is not
-- individually guarded with IF NOT EXISTS — re-run only after that drop.)
-- ============================================================================

create schema if not exists shoot;
grant usage on schema shoot to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enums (namespaced in `shoot`)
-- ---------------------------------------------------------------------------
create type shoot.shoot_type as enum (
  'lifestyle_beach', 'lifestyle_city', 'lifestyle_interior',
  'studio_white', 'studio_ecommerce',
  'editorial_vogue', 'editorial_campaign', 'video_motion'
);
create type shoot.shoot_status as enum (
  'planning', 'active', 'post_production', 'complete', 'archived'
);
create type shoot.asset_status as enum ('pending', 'approved', 'flagged', 'rejected');
create type shoot.shot_status as enum ('pending', 'captured', 'approved');
create type shoot.crew_role as enum (
  'photographer', 'model', 'stylist', 'makeup_artist',
  'hair_stylist', 'assistant', 'producer', 'other'
);
create type shoot.channel as enum (
  'instagram_feed', 'instagram_story', 'instagram_reel', 'tiktok',
  'pinterest', 'amazon', 'shopify', 'facebook', 'youtube', 'website'
);

-- ---------------------------------------------------------------------------
-- shoots — durable shoot record (created after HITL approval)
-- ---------------------------------------------------------------------------
create table shoot.shoots (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  type shoot.shoot_type not null,
  status shoot.shoot_status not null default 'planning',
  start_date date,
  end_date date,
  location text,
  brief text,
  mood_board_urls text[],
  target_channels shoot.channel[],
  dna_score integer check (dna_score >= 0 and dna_score <= 100),
  estimated_budget numeric(10,2),
  actual_cost numeric(10,2),
  currency text not null default 'USD',
  budget_breakdown jsonb,
  created_by uuid references auth.users(id) on delete set null,  -- audit; survive user deletion
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_shoots_brand_id on shoot.shoots(brand_id);
create index idx_shoots_status on shoot.shoots(status);
create index idx_shoots_start_date on shoot.shoots(start_date);

-- ---------------------------------------------------------------------------
-- shoot_assets — uploaded + DNA-scored assets for a shoot
-- ---------------------------------------------------------------------------
create table shoot.shoot_assets (
  id uuid primary key default gen_random_uuid(),
  shoot_id uuid not null references shoot.shoots(id) on delete cascade,
  cloudinary_id text not null,
  url text not null,
  format text,
  width integer,
  height integer,
  bytes integer,
  resource_type text default 'image',
  dna_score integer check (dna_score >= 0 and dna_score <= 100),
  dna_scores jsonb,
  dna_flags jsonb,
  dna_suggestions jsonb,
  status shoot.asset_status not null default 'pending',
  override_by uuid references auth.users(id) on delete set null,  -- audit
  override_reason text,
  audited_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_shoot_assets_shoot_id on shoot.shoot_assets(shoot_id);
create index idx_shoot_assets_status on shoot.shoot_assets(status);
create index idx_shoot_assets_dna_score on shoot.shoot_assets(dna_score);

-- ---------------------------------------------------------------------------
-- shoot_deliverables — channel requirements (planDeliverables output)
-- ---------------------------------------------------------------------------
create table shoot.shoot_deliverables (
  id uuid primary key default gen_random_uuid(),
  shoot_id uuid not null references shoot.shoots(id) on delete cascade,
  channel shoot.channel not null,
  format text,
  quantity int not null check (quantity > 0),
  aspect_ratio text,
  status text not null default 'planned' check (status in ('planned', 'covered', 'delivered')),
  origin text not null default 'ai_approved' check (origin in ('manual', 'ai_approved')),
  created_at timestamptz not null default now()
);
create index idx_shoot_deliverables_shoot_id on shoot.shoot_deliverables(shoot_id);

-- ---------------------------------------------------------------------------
-- shot_list — derived from approved deliverables
-- ---------------------------------------------------------------------------
create table shoot.shot_list (
  id uuid primary key default gen_random_uuid(),
  shoot_id uuid not null references shoot.shoots(id) on delete cascade,
  description text not null,
  channel shoot.channel,
  aspect_ratio text,
  style_notes text,
  priority text default 'medium',
  status shoot.shot_status not null default 'pending',
  "order" integer not null default 0,
  origin text not null default 'manual' check (origin in ('manual', 'ai_approved')),
  created_at timestamptz not null default now()
);
create index idx_shot_list_shoot_id on shoot.shot_list(shoot_id);

-- ---------------------------------------------------------------------------
-- shot_deliverable_links — coverage proof (each shot covers >=1 deliverable)
-- ---------------------------------------------------------------------------
create table shoot.shot_deliverable_links (
  shot_id uuid not null references shoot.shot_list(id) on delete cascade,
  deliverable_id uuid not null references shoot.shoot_deliverables(id) on delete cascade,
  primary key (shot_id, deliverable_id)
);
create index idx_sdl_deliverable_id on shoot.shot_deliverable_links(deliverable_id);

-- ---------------------------------------------------------------------------
-- shoot_crew — exactly one of internal_contact_id / marketplace_vendor_id.
-- NOTE: internal_contact_id is a plain uuid (no FK) because public.contacts
-- does not exist in the current schema chain; add the FK in a follow-up once
-- contacts ships.
-- ---------------------------------------------------------------------------
create table shoot.shoot_crew (
  id uuid primary key default gen_random_uuid(),
  shoot_id uuid not null references shoot.shoots(id) on delete cascade,
  role shoot.crew_role not null,
  confirmed boolean not null default false,
  notes text,
  internal_contact_id uuid,
  marketplace_vendor_id uuid,
  constraint crew_exactly_one_fk check (num_nonnulls(internal_contact_id, marketplace_vendor_id) = 1),
  created_at timestamptz not null default now()
);
create index idx_shoot_crew_shoot_id on shoot.shoot_crew(shoot_id);
create unique index uq_shoot_crew_member
  on shoot.shoot_crew(shoot_id, role, coalesce(internal_contact_id, marketplace_vendor_id));

-- ---------------------------------------------------------------------------
-- shoot_intake_drafts — HITL spine. AI/edge writes here; commit-approved-shoot
-- promotes to durable tables only after approval.
-- Self-approval model uses UUIDs (submitted_by / agent_created_by); agent_run_id
-- is audit-only text and is NEVER compared to an approver.
-- ---------------------------------------------------------------------------
create table shoot.shoot_intake_drafts (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references auth.users(id) on delete cascade,  -- owner of the draft
  brand_id uuid references public.brands(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  draft_shoot jsonb,
  draft_deliverables jsonb,
  draft_shot_list jsonb,
  draft_budget jsonb,
  -- audit trail
  agent_created_by uuid references auth.users(id) on delete set null,  -- agent service identity, if AI-created
  agent_run_id text,                                                   -- audit only; NOT an approver
  source_context jsonb,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  rejected_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_shoot_intake_drafts_submitted_by on shoot.shoot_intake_drafts(submitted_by);
create index idx_shoot_intake_drafts_brand_id on shoot.shoot_intake_drafts(brand_id);
create index idx_shoot_intake_drafts_status on shoot.shoot_intake_drafts(status);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create or replace function shoot.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_shoots_updated_at
  before update on shoot.shoots
  for each row execute function shoot.set_updated_at();

-- Recalculate a shoot's dna_score as the avg of its approved assets.
create or replace function shoot.recalc_shoot_dna_score()
returns trigger language plpgsql set search_path = '' as $$
declare
  target_shoot uuid := coalesce(new.shoot_id, old.shoot_id);
begin
  update shoot.shoots s
  set dna_score = (
    select avg(a.dna_score)::integer
    from shoot.shoot_assets a
    where a.shoot_id = target_shoot and a.status = 'approved'
  )
  where s.id = target_shoot;
  return null;
end;
$$;

create trigger trg_recalc_shoot_dna_score
  after insert or update or delete on shoot.shoot_assets
  for each row execute function shoot.recalc_shoot_dna_score();

-- Self-approval guard: the approver must differ from the human submitter AND
-- from the agent identity (if any). UUID comparisons only.
create or replace function shoot.block_self_approval()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.approved_by is not null then
    if new.approved_by = new.submitted_by then
      raise exception 'Self-approval forbidden: approved_by must differ from submitted_by';
    end if;
    if new.agent_created_by is not null and new.approved_by = new.agent_created_by then
      raise exception 'Self-approval forbidden: approved_by must differ from agent_created_by';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_shoot_intake_drafts_block_self_approval
  before update on shoot.shoot_intake_drafts
  for each row execute function shoot.block_self_approval();

-- ---------------------------------------------------------------------------
-- Row Level Security — SELECT for brand owners; writes via service role only.
-- ---------------------------------------------------------------------------
alter table shoot.shoots enable row level security;
alter table shoot.shoot_assets enable row level security;
alter table shoot.shoot_deliverables enable row level security;
alter table shoot.shot_list enable row level security;
alter table shoot.shot_deliverable_links enable row level security;
alter table shoot.shoot_crew enable row level security;
alter table shoot.shoot_intake_drafts enable row level security;

create policy shoots_select_owner on shoot.shoots
  for select to authenticated
  using (brand_id in (select id from public.brands where user_id = (select auth.uid())));

create policy shoot_assets_select_owner on shoot.shoot_assets
  for select to authenticated
  using (shoot_id in (
    select id from shoot.shoots
    where brand_id in (select id from public.brands where user_id = (select auth.uid()))
  ));

create policy shoot_deliverables_select_owner on shoot.shoot_deliverables
  for select to authenticated
  using (shoot_id in (
    select id from shoot.shoots
    where brand_id in (select id from public.brands where user_id = (select auth.uid()))
  ));

create policy shot_list_select_owner on shoot.shot_list
  for select to authenticated
  using (shoot_id in (
    select id from shoot.shoots
    where brand_id in (select id from public.brands where user_id = (select auth.uid()))
  ));

create policy shoot_crew_select_owner on shoot.shoot_crew
  for select to authenticated
  using (shoot_id in (
    select id from shoot.shoots
    where brand_id in (select id from public.brands where user_id = (select auth.uid()))
  ));

create policy sdl_select_owner on shoot.shot_deliverable_links
  for select to authenticated
  using (deliverable_id in (
    select d.id from shoot.shoot_deliverables d
    where d.shoot_id in (
      select id from shoot.shoots
      where brand_id in (select id from public.brands where user_id = (select auth.uid()))
    )
  ));

-- Drafts are personal HITL workspaces: visible only to their submitter, NOT to
-- brand co-owners (by design). Writes happen via service-role edge functions.
create policy shoot_intake_drafts_select_owner on shoot.shoot_intake_drafts
  for select to authenticated
  using (submitted_by = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Grants — authenticated reads (RLS-gated); service_role full (edge functions).
-- Default privileges keep follow-up tables in this schema consistent.
-- ---------------------------------------------------------------------------
grant select on all tables in schema shoot to authenticated;
grant all on all tables in schema shoot to service_role;
alter default privileges in schema shoot grant select on tables to authenticated;
alter default privileges in schema shoot grant all on tables to service_role;

-- MI-01 — Media spec reference tables + KB seed (docs/media/02-image-types.md §13.2 schema, §1–12 values)
-- Global reference data: authenticated SELECT, no tenant scope, seed-only (no write policies).

-- ---------- enums ----------
do $$ begin
  create type public.spec_confidence as enum ('official', 'community', 'estimated');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.campaign_objective_type as enum (
    'brand_awareness', 'product_launch', 'conversion', 'retention',
    'community', 'seo_discovery', 'ecommerce_direct');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.funnel_stage_type as enum (
    'awareness', 'consideration', 'conversion', 'retention');
exception when duplicate_object then null; end $$;

-- ---------- tables ----------
create table if not exists public.platforms (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  name         text not null,
  category     text not null check (category in ('social', 'ecommerce', 'advertising')),
  has_shopping boolean not null default false,
  has_paid_ads boolean not null default false,
  has_stories  boolean not null default false,
  has_carousel boolean not null default false,
  created_at   timestamptz not null default now()
);

create table if not exists public.image_type_defs (
  id                       uuid primary key default gen_random_uuid(),
  slug                     text unique not null,
  name                     text not null,
  description              text,
  category                 text not null check (category in
    ('profile', 'feed', 'story', 'ad', 'product', 'cover', 'thumbnail', 'banner')),
  is_organic               boolean not null default true,
  is_paid                  boolean not null default false,
  is_shopping              boolean not null default false,
  best_campaign_objectives public.campaign_objective_type[],
  best_funnel_stages       public.funnel_stage_type[],
  best_industries          text[],
  created_at               timestamptz not null default now()
);

create table if not exists public.image_specs (
  id                     uuid primary key default gen_random_uuid(),
  platform_id            uuid references public.platforms(id) on delete cascade,
  image_type_id          uuid references public.image_type_defs(id) on delete cascade,
  width_px               integer not null,
  height_px              integer not null,
  min_width_px           integer,
  min_height_px          integer,
  max_width_px           integer,
  max_height_px          integer,
  aspect_ratio_w         integer,
  aspect_ratio_h         integer,
  aspect_ratio_label     text,
  accepted_formats       text[] not null,
  max_file_size_mb       numeric,
  recommended_color_mode text,
  safe_zone_top_px       integer,
  safe_zone_bottom_px    integer,
  safe_zone_left_px      integer,
  safe_zone_right_px     integer,
  background_required    text,
  product_fill_min_pct   integer,
  spec_confidence        public.spec_confidence not null default 'community',
  organic                boolean not null default true,
  paid                   boolean not null default false,
  shopping_support       boolean not null default false,
  mobile_notes           text,
  desktop_notes          text,
  crop_notes             text,
  best_use_cases         text[],
  source_url             text,
  last_verified_at       timestamptz,
  created_at             timestamptz not null default now(),
  unique (platform_id, image_type_id, width_px, height_px)
);

-- Channel → spec bridge. The Mastra tool channel enum (e.g. 'instagram_feed') is more
-- granular than a platform; a channel_required rule maps a channel to its platform + image
-- type slugs, which lookupChannelSpecs (MI-02) joins to image_specs.
create table if not exists public.recommendation_rules (
  id               uuid primary key default gen_random_uuid(),
  rule_type        text not null check (rule_type in
    ('channel_required', 'objective_best', 'category_best', 'missing_asset')),
  condition_key    text not null,
  condition_value  text not null,
  priority         integer not null default 0,
  image_type_slugs text[] not null,
  platform_slugs   text[],
  notes            text,
  created_at       timestamptz not null default now(),
  unique (rule_type, condition_key, condition_value)
);

-- ---------- indexes ----------
create index if not exists idx_image_specs_platform on public.image_specs(platform_id);
create index if not exists idx_image_specs_type     on public.image_specs(image_type_id);
create index if not exists idx_rec_rules_type_value on public.recommendation_rules(rule_type, condition_value);

-- ---------- RLS: global reference data, authenticated read-only ----------
alter table public.platforms            enable row level security;
alter table public.image_type_defs      enable row level security;
alter table public.image_specs          enable row level security;
alter table public.recommendation_rules enable row level security;

drop policy if exists "platforms_select_authenticated" on public.platforms;
create policy "platforms_select_authenticated" on public.platforms
  for select to authenticated using (true);

drop policy if exists "image_type_defs_select_authenticated" on public.image_type_defs;
create policy "image_type_defs_select_authenticated" on public.image_type_defs
  for select to authenticated using (true);

drop policy if exists "image_specs_select_authenticated" on public.image_specs;
create policy "image_specs_select_authenticated" on public.image_specs
  for select to authenticated using (true);

drop policy if exists "recommendation_rules_select_authenticated" on public.recommendation_rules;
create policy "recommendation_rules_select_authenticated" on public.recommendation_rules
  for select to authenticated using (true);

-- ================= SEED (values traceable to docs/media/02-image-types.md) =================

-- Platforms (§1 matrix, §10 ecommerce)
insert into public.platforms (slug, name, category, has_shopping, has_paid_ads, has_stories, has_carousel) values
  ('instagram', 'Instagram', 'social',    true,  true,  true,  true),
  ('facebook',  'Facebook',  'social',    true,  true,  true,  true),
  ('tiktok',    'TikTok',    'social',    true,  true,  true,  true),
  ('pinterest', 'Pinterest', 'social',    true,  true,  false, true),
  ('youtube',   'YouTube',   'social',    false, true,  false, false),
  ('amazon',    'Amazon',    'ecommerce', true,  true,  false, false),
  ('shopify',   'Shopify',   'ecommerce', true,  false, false, false)
on conflict (slug) do nothing;

-- Image type definitions
insert into public.image_type_defs (slug, name, category, is_shopping) values
  ('feed_post',     'Feed Post',           'feed',      false),
  ('story',         'Story',               'story',     false),
  ('reel_cover',    'Reel Cover',          'cover',     false),
  ('video_cover',   'Video Cover Frame',   'cover',     false),
  ('pin',           'Pin',                 'feed',      false),
  ('thumbnail',     'Video Thumbnail',     'thumbnail', false),
  ('main_image',    'Main Product Image',  'product',   true),
  ('product_image', 'Product Image',       'product',   true)
on conflict (slug) do nothing;

-- Image specs (one row per channel target; cited section in crop_notes)
insert into public.image_specs (
  platform_id, image_type_id, width_px, height_px,
  aspect_ratio_w, aspect_ratio_h, aspect_ratio_label,
  accepted_formats, max_file_size_mb, background_required, product_fill_min_pct,
  safe_zone_top_px, safe_zone_bottom_px, spec_confidence, crop_notes, last_verified_at)
select p.id, t.id, s.w, s.h, s.arw, s.arh, s.arlabel,
       s.formats, s.maxmb, s.bg, s.fill, s.safetop, s.safebottom,
       s.conf::public.spec_confidence, s.src, now()
from (values
  ('instagram', 'feed_post',     1080, 1350, 4,  5,  '4:5',  array['JPG','PNG','BMP'], 8::numeric,  null::text,  null::int, null::int, null::int, 'official', '§2.3'),
  ('instagram', 'story',         1080, 1920, 9,  16, '9:16', array['JPG','PNG'],       30::numeric, null,        null,      250,       250,       'official', '§2.6'),
  ('instagram', 'reel_cover',    1080, 1920, 9,  16, '9:16', array['JPG','PNG'],       null,        null,        null,      null,      null,      'official', '§2.8'),
  ('facebook',  'feed_post',     1080, 1080, 1,  1,  '1:1',  array['JPG','PNG','GIF'], 30::numeric, null,        null,      null,      null,      'official', '§3.3'),
  ('tiktok',    'video_cover',   1080, 1920, 9,  16, '9:16', array['JPG','PNG'],       null,        null,        null,      null,      null,      'community','§1, §12.1'),
  ('pinterest', 'pin',           1000, 1500, 2,  3,  '2:3',  array['JPG','PNG'],       20::numeric, null,        null,      null,      null,      'official', '§5.3'),
  ('youtube',   'thumbnail',     1280, 720,  16, 9,  '16:9', array['JPG','PNG','GIF'], 2::numeric,  null,        null,      null,      null,      'official', '§8.3'),
  ('amazon',    'main_image',    2000, 2000, 1,  1,  '1:1',  array['JPEG'],            10::numeric, 'pure_white',85,        null,      null,      'official', '§10.2'),
  ('shopify',   'product_image', 2048, 2048, 1,  1,  '1:1',  array['JPEG','PNG','WEBP'],20::numeric, null,       null,      null,      null,      'official', '§10.1')
) as s(pslug, tslug, w, h, arw, arh, arlabel, formats, maxmb, bg, fill, safetop, safebottom, conf, src)
join public.platforms p       on p.slug = s.pslug
join public.image_type_defs t on t.slug = s.tslug
on conflict (platform_id, image_type_id, width_px, height_px) do nothing;

-- Channel → spec bridge rules (channel slugs match the Mastra tool enum; 'website' intentionally absent → empty result)
insert into public.recommendation_rules (rule_type, condition_key, condition_value, image_type_slugs, platform_slugs) values
  ('channel_required', 'channel', 'instagram_feed',  array['feed_post'],     array['instagram']),
  ('channel_required', 'channel', 'instagram_story', array['story'],         array['instagram']),
  ('channel_required', 'channel', 'instagram_reel',  array['reel_cover'],    array['instagram']),
  ('channel_required', 'channel', 'facebook',        array['feed_post'],     array['facebook']),
  ('channel_required', 'channel', 'tiktok',          array['video_cover'],   array['tiktok']),
  ('channel_required', 'channel', 'pinterest',       array['pin'],           array['pinterest']),
  ('channel_required', 'channel', 'youtube',         array['thumbnail'],     array['youtube']),
  ('channel_required', 'channel', 'amazon',          array['main_image'],    array['amazon']),
  ('channel_required', 'channel', 'shopify',         array['product_image'], array['shopify'])
on conflict (rule_type, condition_key, condition_value) do nothing;

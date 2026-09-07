-- IPI-184 SHOOT-DATA-002 — Shot type reference library
-- Source: Squareshot UX audit + iPix production taxonomy (squareshot.md)
-- 49 vetted shot types across 8 categories used by the production-planner
-- agent for lookupShotReferences suggestions and ShotListApprovalCard UI.
-- Rollback: drop table shoot.shot_type_references;

create table if not exists shoot.shot_type_references (
  id             uuid primary key default gen_random_uuid(),
  category       text not null,     -- 'clothing', 'beauty', 'accessories', 'home_goods', 'ai_services'
  subcategory    text not null,     -- 'flat_lay', 'ghost', 'model', 'product', 'swatch', etc.
  angle          text not null,     -- human-readable shot name
  description    text not null,
  channel_fit    text[] not null,   -- channels this shot type covers
  model_type     text,              -- 'full_body' | 'half_body' | 'hands' | null
  background     text,              -- 'white' | 'lifestyle' | 'custom_backdrop' | 'studio_gradient'
  tags           text[] default '{}',
  created_at     timestamptz default now()
);

-- RLS: read-only for authenticated users; no user can write (managed by service role)
alter table shoot.shot_type_references enable row level security;
drop policy if exists "authenticated can read shot references" on shoot.shot_type_references;
create policy "authenticated can read shot references"
  on shoot.shot_type_references for select to authenticated using (true);

-- Expose to REST API via public view (anon key clients)
create or replace view public.shot_type_references_view as
  select id, category, subcategory, angle, description, channel_fit, model_type, background, tags
  from shoot.shot_type_references;
grant select on public.shot_type_references_view to authenticated;

-- ── Seed (skip if already populated — remote drift repair IPI-225) ─────────────

DO $$
BEGIN
  IF (SELECT count(*) FROM shoot.shot_type_references) > 0 THEN
    RAISE NOTICE 'shot_type_references already seeded — skipping';
    RETURN;
  END IF;

  INSERT INTO shoot.shot_type_references
  (category, subcategory, angle, description, channel_fit, model_type, background, tags)
values

-- CLOTHING — FLAT LAY
('clothing', 'flat_lay', 'Front flat lay',
 'Garment laid flat, front facing, white background',
 array['shopify_pdp','amazon'], null, 'white',
 array['flat_lay','front','clothing']),

('clothing', 'flat_lay', 'Back flat lay',
 'Rear view flat lay on white background',
 array['shopify_pdp','amazon'], null, 'white',
 array['flat_lay','back','clothing']),

('clothing', 'flat_lay', 'Detail flat lay',
 'Close-up of fabric, label, or care tag',
 array['shopify_pdp'], null, 'white',
 array['flat_lay','detail','texture','clothing']),

('clothing', 'flat_lay', 'Styled flat lay',
 'Garment with props, accessories, and lifestyle context',
 array['instagram_feed','pinterest'], null, 'lifestyle',
 array['flat_lay','styled','lifestyle','clothing']),

('clothing', 'flat_lay', 'Knolling',
 'Top-down overhead organization of all items',
 array['instagram_feed','instagram_story','pinterest'], null, 'white',
 array['flat_lay','knolling','overhead','clothing']),

-- CLOTHING — GHOST (Invisible Mannequin)
('clothing', 'ghost', 'Ghost front',
 'Full front view on ghost/invisible mannequin',
 array['shopify_pdp','amazon'], null, 'white',
 array['ghost','front','mannequin','clothing']),

('clothing', 'ghost', 'Ghost back',
 'Full back view on ghost mannequin',
 array['shopify_pdp','amazon'], null, 'white',
 array['ghost','back','mannequin','clothing']),

('clothing', 'ghost', 'Ghost side',
 'Side profile on ghost mannequin',
 array['shopify_pdp'], null, 'white',
 array['ghost','side','mannequin','clothing']),

('clothing', 'ghost', 'Ghost detail',
 'Close-up of collar, hem, zipper, or hardware detail on ghost mannequin',
 array['shopify_pdp'], null, 'white',
 array['ghost','detail','mannequin','clothing']),

('clothing', 'ghost', 'Ghost 3/4',
 'Three-quarter angle view on ghost mannequin',
 array['shopify_pdp','website'], null, 'white',
 array['ghost','3/4','mannequin','clothing']),

-- CLOTHING — MODEL
('clothing', 'model', 'Full body front',
 'Standing model, full length, front facing',
 array['shopify_pdp','instagram_feed','amazon'], 'full_body', 'studio_gradient',
 array['model','full_body','front','clothing']),

('clothing', 'model', 'Full body back',
 'Rear facing full length model shot',
 array['shopify_pdp','amazon'], 'full_body', 'studio_gradient',
 array['model','full_body','back','clothing']),

('clothing', 'model', 'Full body side',
 'Profile/side view, full length',
 array['shopify_pdp'], 'full_body', 'studio_gradient',
 array['model','full_body','side','clothing']),

('clothing', 'model', 'Half body',
 'Waist-up model shot',
 array['instagram_feed','instagram_story'], 'half_body', 'studio_gradient',
 array['model','half_body','clothing']),

('clothing', 'model', 'Close-up detail on model',
 'Detail of garment on body — collar, cuff, texture',
 array['instagram_feed','tiktok'], 'half_body', 'lifestyle',
 array['model','detail','close_up','clothing']),

('clothing', 'model', 'Lifestyle indoor',
 'Model in styled indoor scene wearing the garment',
 array['instagram_feed','tiktok'], 'full_body', 'lifestyle',
 array['model','lifestyle','indoor','clothing']),

('clothing', 'model', 'Lifestyle outdoor',
 'Model in outdoor scene — street, nature, or editorial setting',
 array['instagram_feed','tiktok','website'], 'full_body', 'lifestyle',
 array['model','lifestyle','outdoor','clothing']),

('clothing', 'model', 'Movement / action',
 'Model in motion — walking, spinning, jumping',
 array['tiktok','instagram_reel'], 'full_body', 'lifestyle',
 array['model','action','movement','tiktok','clothing']),

('clothing', 'model', 'Editorial pose',
 'Fashion editorial style pose for campaign use',
 array['instagram_feed','website'], 'full_body', 'custom_backdrop',
 array['model','editorial','fashion','clothing']),

-- BEAUTY — PRODUCT
('beauty', 'product', 'Hero overhead',
 'Top-down flat lay of product on white or gradient background',
 array['amazon','shopify_pdp'], null, 'white',
 array['beauty','overhead','hero','product']),

('beauty', 'product', '45° hero',
 'Classic three-quarter angle on white background',
 array['amazon','shopify_pdp'], null, 'white',
 array['beauty','45deg','hero','product']),

('beauty', 'product', 'Side profile',
 'Direct side view showing packaging silhouette',
 array['shopify_pdp','amazon'], null, 'white',
 array['beauty','side','profile','product']),

('beauty', 'product', 'Detail texture',
 'Extreme close-up of product texture, finish, or formula',
 array['shopify_pdp','instagram_feed'], null, 'white',
 array['beauty','detail','texture','macro','product']),

('beauty', 'product', 'Cap / lid close-up',
 'Focus on packaging detail — cap, lid, pump, or label',
 array['shopify_pdp'], null, 'white',
 array['beauty','detail','packaging','product']),

('beauty', 'product', 'Group / range',
 'Multiple products from the same range grouped together',
 array['instagram_feed','website'], null, 'white',
 array['beauty','group','range','campaign','product']),

('beauty', 'product', 'Lifestyle styled',
 'Product with complementary props and lifestyle context',
 array['instagram_feed','tiktok'], null, 'lifestyle',
 array['beauty','lifestyle','styled','product']),

('beauty', 'product', 'On-model in-use',
 'Model applying or using the product — hands or face visible',
 array['instagram_feed','tiktok'], 'hands', 'lifestyle',
 array['beauty','model','in_use','hands','product']),

('beauty', 'product', 'Splash / pour',
 'Liquid product captured in motion — pour, splash, or drip',
 array['instagram_feed','website'], null, 'custom_backdrop',
 array['beauty','splash','pour','motion','product']),

-- BEAUTY — SWATCHES
('beauty', 'swatch', 'Color range spread',
 'All shades arranged in a gradient or fan spread',
 array['shopify_pdp','instagram_feed'], null, 'white',
 array['beauty','swatch','color','range']),

('beauty', 'swatch', 'Macro texture',
 'Extreme close-up of a single swatch on skin showing texture and finish',
 array['shopify_pdp','instagram_feed'], 'hands', 'white',
 array['beauty','swatch','macro','texture','skin']),

('beauty', 'swatch', 'Application brush',
 'Swatch applied with a brush showing color payoff',
 array['shopify_pdp'], 'hands', 'white',
 array['beauty','swatch','brush','application']),

('beauty', 'swatch', 'Comparison spread',
 'Multiple shades swatched side-by-side on skin for comparison',
 array['shopify_pdp','instagram_feed'], 'hands', 'white',
 array['beauty','swatch','comparison','skin']),

-- ACCESSORIES
('accessories', 'product', 'Hero white',
 'Clean white background hero shot, front facing',
 array['amazon','shopify_pdp'], null, 'white',
 array['accessories','hero','white','clean']),

('accessories', 'product', '45° angle',
 'Classic 45° angle on white — shows depth and form',
 array['amazon','shopify_pdp'], null, 'white',
 array['accessories','45deg','white']),

('accessories', 'product', 'Detail close-up',
 'Hardware, stitching, texture, or logo close-up',
 array['shopify_pdp'], null, 'white',
 array['accessories','detail','close_up','hardware']),

('accessories', 'model', 'On-model worn',
 'Accessory worn by model — jewelry, bag, sunglasses',
 array['instagram_feed','tiktok'], 'half_body', 'lifestyle',
 array['accessories','model','worn','lifestyle']),

('accessories', 'product', 'Lifestyle styled',
 'Accessory with context props and styled surface',
 array['instagram_feed','tiktok'], null, 'lifestyle',
 array['accessories','lifestyle','styled','props']),

('accessories', 'flat_lay', 'Flat lay styled',
 'Overhead flat lay with complementary styling items',
 array['instagram_feed','pinterest'], null, 'lifestyle',
 array['accessories','flat_lay','overhead','styled']),

-- HOME GOODS
('home_goods', 'product', 'Hero overhead styled',
 'Top-down product in styled scene showing use context',
 array['shopify_pdp','amazon'], null, 'lifestyle',
 array['home_goods','overhead','hero','styled']),

('home_goods', 'product', '45° studio',
 'Clean 45° angle with studio lighting, neutral background',
 array['amazon','shopify_pdp'], null, 'white',
 array['home_goods','45deg','studio','clean']),

('home_goods', 'lifestyle', 'Lifestyle room scene',
 'Product in a fully styled room or interior scene',
 array['instagram_feed','pinterest'], null, 'lifestyle',
 array['home_goods','lifestyle','room','interior']),

('home_goods', 'product', 'Detail material',
 'Close-up of material, texture, finish, or grain',
 array['shopify_pdp'], null, 'white',
 array['home_goods','detail','material','texture']),

('home_goods', 'lifestyle', 'In-use context',
 'Product being used in its natural context',
 array['instagram_feed','tiktok'], null, 'lifestyle',
 array['home_goods','in_use','lifestyle']),

('home_goods', 'product', 'Scale reference',
 'Product shown with a human or common object to convey size',
 array['amazon','shopify_pdp'], 'full_body', 'lifestyle',
 array['home_goods','scale','reference','size']),

-- AI SERVICES
('ai_services', 'ai', 'Background replacement',
 'Swap white studio background for a lifestyle scene or gradient',
 array['shopify_pdp','instagram_feed'], null, 'lifestyle',
 array['ai','background','replacement']),

('ai_services', 'ai', 'AI lifestyle',
 'AI-generated model or scene surrounding the product',
 array['instagram_feed','tiktok'], null, 'lifestyle',
 array['ai','lifestyle','generated']),

('ai_services', 'ai', 'AI campaign',
 'Cohesive 5-image AI-generated campaign from a single product shot',
 array['instagram_feed','instagram_story','website'], null, 'lifestyle',
 array['ai','campaign','cohesive']),

('ai_services', 'ai', 'AI model',
 'AI-generated model wearing the product',
 array['shopify_pdp','instagram_feed'], 'full_body', 'lifestyle',
 array['ai','model','generated','fashion']),

('ai_services', 'ai', 'Scene generation',
 'Full AI-generated product scene with environment and lighting',
 array['instagram_feed','website'], null, 'lifestyle',
 array['ai','scene','environment','generated']);
END $$;

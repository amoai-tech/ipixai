-- IPI-737 BRAND-DATA-001 — backfill brand_url for the two demo brands stuck at
-- NULL, which made "Start analysis" correctly (but unhelpfully) refuse with
-- "Brand has no website URL to analyze" (IPI-722). Migration-only: no schema,
-- RLS, function, or frontend change. Data-only, by immutable id, not name.
--
-- QA Test Brand (db1f728d-bee1-430e-a3e7-0c601da74ce7) is deliberately left
-- untouched — no controlled/crawlable test fixture domain exists yet; see
-- IPI-737 scope notes.

DO $$
DECLARE
  nike_url_before text;
  adidas_url_before text;
BEGIN
  SELECT brand_url INTO nike_url_before
  FROM public.brands WHERE id = '00000000-0000-0000-0000-000000000201';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'IPI-737: Nike brand row (00000000-0000-0000-0000-000000000201) not found';
  END IF;
  IF nike_url_before IS NOT NULL AND nike_url_before <> 'https://www.nike.com' THEN
    RAISE EXCEPTION 'IPI-737: Nike brand_url already set to unexpected value: %', nike_url_before;
  END IF;

  SELECT brand_url INTO adidas_url_before
  FROM public.brands WHERE id = '00000000-0000-0000-0000-000000000202';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'IPI-737: Adidas brand row (00000000-0000-0000-0000-000000000202) not found';
  END IF;
  IF adidas_url_before IS NOT NULL AND adidas_url_before <> 'https://www.adidas.com' THEN
    RAISE EXCEPTION 'IPI-737: Adidas brand_url already set to unexpected value: %', adidas_url_before;
  END IF;
END $$;

UPDATE public.brands
SET brand_url = 'https://www.nike.com'
WHERE id = '00000000-0000-0000-0000-000000000201';

UPDATE public.brands
SET brand_url = 'https://www.adidas.com'
WHERE id = '00000000-0000-0000-0000-000000000202';

-- Rollback (manual, if ever needed):
-- UPDATE public.brands SET brand_url = NULL WHERE id = '00000000-0000-0000-0000-000000000201';
-- UPDATE public.brands SET brand_url = NULL WHERE id = '00000000-0000-0000-0000-000000000202';

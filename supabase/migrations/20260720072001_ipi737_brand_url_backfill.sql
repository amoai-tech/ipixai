-- IPI-737 BRAND-DATA-001 — backfill brand_url for the two demo brands stuck at
-- NULL, which made "Start analysis" correctly (but unhelpfully) refuse with
-- "Brand has no website URL to analyze" (IPI-722). Migration-only: no schema,
-- RLS, function, or frontend change. Data-only, by immutable id, not name.
--
-- QA Test Brand (db1f728d-bee1-430e-a3e7-0c601da74ce7) is deliberately left
-- untouched — no controlled/crawlable test fixture domain exists yet; see
-- IPI-737 scope notes.
--
-- IPI-1162 · SB-MIG-003 fresh-replay adaptation: the original guard aborted
-- the whole migration chain if either demo row was absent — correct for
-- production (where both rows are real and this was a genuine invariant
-- check) but wrong for a fresh database, which legitimately has neither row.
-- Made presence-tolerant per-row rather than manufacturing the rows via a
-- separate seed migration (rejected: that would inject demo/application
-- data into every fresh environment and add a migration timestamp production
-- never had). Net effect on production is unchanged — both rows exist there
-- with the expected values, so this migration's real, historical behavior
-- (backfill the two known-NULL brand_url columns) is unaffected:
--   * row absent           -> skip (fresh database; nothing to backfill)
--   * row present, NULL    -> set the expected URL (the original intent)
--   * row present, expected -> no-op
--   * row present, other   -> fail closed (original invariant preserved)

DO $$
DECLARE
  nike_url_before text;
  nike_found boolean;
  adidas_url_before text;
  adidas_found boolean;
BEGIN
  SELECT brand_url INTO nike_url_before
  FROM public.brands WHERE id = '00000000-0000-0000-0000-000000000201';
  nike_found := FOUND;

  IF nike_found AND nike_url_before IS NOT NULL AND nike_url_before <> 'https://www.nike.com' THEN
    RAISE EXCEPTION 'IPI-737: Nike brand_url already set to unexpected value: %', nike_url_before;
  END IF;

  SELECT brand_url INTO adidas_url_before
  FROM public.brands WHERE id = '00000000-0000-0000-0000-000000000202';
  adidas_found := FOUND;

  IF adidas_found AND adidas_url_before IS NOT NULL AND adidas_url_before <> 'https://www.adidas.com' THEN
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

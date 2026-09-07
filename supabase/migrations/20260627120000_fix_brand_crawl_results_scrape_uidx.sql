-- IPI-24: PostgREST upsert requires non-partial unique index for ON CONFLICT inference
-- Partial index (WHERE firecrawl_scrape_id IS NOT NULL) breaks .upsert(onConflict: crawl_id,firecrawl_scrape_id)

DROP INDEX IF EXISTS public.brand_crawl_results_crawl_scrape_uidx;

CREATE UNIQUE INDEX brand_crawl_results_crawl_scrape_uidx
  ON public.brand_crawl_results (crawl_id, firecrawl_scrape_id);

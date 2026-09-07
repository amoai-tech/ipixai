-- IPI-24 · brand_crawls job history + brand_crawl_results per-page evolution
-- Additive on IPI-26. Safe to apply before edge functions; backfill legacy job blobs separately.

DO $$ BEGIN
  CREATE TYPE public.brand_crawl_job_status AS ENUM (
    'queued', 'running', 'complete', 'failed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.brand_crawl_pipeline_state AS ENUM (
    'crawl_only',
    'pending_analysis',
    'analysis_running',
    'analysis_complete',
    'scoring_running',
    'scoring_complete',
    'pipeline_failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.brand_crawls (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id            uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  firecrawl_job_id    text UNIQUE,
  source_url          text NOT NULL,
  job_status          public.brand_crawl_job_status NOT NULL DEFAULT 'queued',
  pipeline_state      public.brand_crawl_pipeline_state DEFAULT 'crawl_only',
  pages_found         int NOT NULL DEFAULT 0,
  pages_crawled       int NOT NULL DEFAULT 0,
  pages_failed        int NOT NULL DEFAULT 0,
  retry_count         int NOT NULL DEFAULT 0,
  idempotency_key     text,
  started_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  workflow_id         text,
  request_id          text,
  duration_ms         int,
  raw_payload         jsonb NOT NULL DEFAULT '{}',
  raw_data            jsonb NOT NULL DEFAULT '{}',
  started_at          timestamptz,
  completed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brand_crawls_brand_id_idx
  ON public.brand_crawls (brand_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS brand_crawls_idempotency_active_uidx
  ON public.brand_crawls (brand_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL
    AND job_status NOT IN ('failed', 'cancelled');

COMMENT ON TABLE public.brand_crawls IS
  'Firecrawl crawl job history per brand. Realtime source for crawl progress (IPI-24/31).';

ALTER TABLE public.brand_crawls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brand_crawls_select_org_member" ON public.brand_crawls;
CREATE POLICY "brand_crawls_select_org_member"
  ON public.brand_crawls FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_crawls.brand_id
        AND public.is_org_member(b.org_id)
    )
  );

-- Per-page results (create if missing, else evolve IPI-26 job-blob table)
CREATE TABLE IF NOT EXISTS public.brand_crawl_results (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id            uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  crawl_id            uuid REFERENCES public.brand_crawls(id) ON DELETE CASCADE,
  page_url            text,
  title               text,
  description         text,
  status_code         int,
  word_count          int,
  page_depth          int,
  markdown            text,
  raw_json            jsonb NOT NULL DEFAULT '{}',
  firecrawl_scrape_id text,
  -- legacy IPI-26 job columns (nullable when using page-only rows)
  firecrawl_job_id    text,
  status              text,
  pages_crawled       int,
  raw_data            jsonb NOT NULL DEFAULT '{}',
  started_at          timestamptz,
  completed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF to_regclass('public.brand_crawl_results') IS NOT NULL THEN
    ALTER TABLE public.brand_crawl_results
      ADD COLUMN IF NOT EXISTS crawl_id uuid REFERENCES public.brand_crawls(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS page_url text,
      ADD COLUMN IF NOT EXISTS title text,
      ADD COLUMN IF NOT EXISTS description text,
      ADD COLUMN IF NOT EXISTS status_code int,
      ADD COLUMN IF NOT EXISTS word_count int,
      ADD COLUMN IF NOT EXISTS page_depth int,
      ADD COLUMN IF NOT EXISTS markdown text,
      ADD COLUMN IF NOT EXISTS raw_json jsonb NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS firecrawl_scrape_id text,
      ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS firecrawl_job_id text,
      ADD COLUMN IF NOT EXISTS status text,
      ADD COLUMN IF NOT EXISTS pages_crawled int,
      ADD COLUMN IF NOT EXISTS raw_data jsonb NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS started_at timestamptz,
      ADD COLUMN IF NOT EXISTS completed_at timestamptz,
      ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS brand_crawl_results_brand_id_idx
  ON public.brand_crawl_results (brand_id);

CREATE UNIQUE INDEX IF NOT EXISTS brand_crawl_results_crawl_page_uidx
  ON public.brand_crawl_results (crawl_id, page_url);

CREATE UNIQUE INDEX IF NOT EXISTS brand_crawl_results_crawl_scrape_uidx
  ON public.brand_crawl_results (crawl_id, firecrawl_scrape_id);

ALTER TABLE public.brand_crawl_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brand_crawl_results_select_org_member" ON public.brand_crawl_results;
CREATE POLICY "brand_crawl_results_select_org_member"
  ON public.brand_crawl_results FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_crawl_results.brand_id
        AND public.is_org_member(b.org_id)
    )
  );

-- Realtime on job table for IPI-31 progress UX
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'brand_crawls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.brand_crawls;
  END IF;
END $$;

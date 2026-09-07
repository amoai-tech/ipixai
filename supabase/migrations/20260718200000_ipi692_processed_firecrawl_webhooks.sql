-- IPI-692 · SB-EDGE-008 — Firecrawl webhook delivery claims (retryable)
-- Prefer Firecrawl webhookId (stable across retries); UNIQUE (job, event)
-- catches crawl payloads that omit webhookId.
--
-- status:
--   processing — lease held; not terminal (retry after failure or stale lease)
--   processed  — terminal success; duplicates skip forever
--   failed     — terminal handler error; next delivery may reclaim

CREATE TABLE IF NOT EXISTS public.processed_firecrawl_webhooks (
  webhook_id text PRIMARY KEY,
  firecrawl_job_id text NOT NULL,
  event_type text NOT NULL,
  crawl_id uuid REFERENCES public.brand_crawls(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'processed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT processed_firecrawl_webhooks_job_event_uidx
    UNIQUE (firecrawl_job_id, event_type)
);

COMMENT ON TABLE public.processed_firecrawl_webhooks IS
  'IPI-692 — webhook delivery claim. status=processed is permanent dedup; processing/failed allow reclaim so resume failures are not stuck.';

CREATE INDEX IF NOT EXISTS processed_firecrawl_webhooks_status_updated_idx
  ON public.processed_firecrawl_webhooks (status, updated_at);

ALTER TABLE public.processed_firecrawl_webhooks ENABLE ROW LEVEL SECURITY;

-- Service-role Edge only; no anon/authenticated policies (deny by default).
REVOKE ALL ON TABLE public.processed_firecrawl_webhooks FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.processed_firecrawl_webhooks TO service_role;

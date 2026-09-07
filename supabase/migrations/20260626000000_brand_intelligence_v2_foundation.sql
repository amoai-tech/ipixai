-- IPI-26 / IPI-BI-003 — brands lifecycle enum, instagram_handle, brand_scores audit columns
-- IPI-614: added add column intake_status (column was missing from migration chain,
-- existed on remote only via OOB SQL; the alter type / set default / set not null
-- statements below require it to exist for db reset reproducibility).

do $$
begin
  if not exists (select 1 from pg_type where typname = 'brand_intake_status') then
    create type public.brand_intake_status as enum (
      'brand_created',
      'crawl_running',
      'crawl_complete',
      'analysis_running',
      'scores_complete',
      'ready',
      'failed'
    );
  end if;
end $$;

alter table public.brands
  add column if not exists instagram_handle text;

alter table public.brands
  add column if not exists intake_status text;

alter table public.brands
  alter column intake_status drop default;

alter table public.brands
  drop constraint if exists brands_intake_status_check;

update public.brands
set intake_status = case coalesce(intake_status::text, '')
  when 'approved' then 'ready'
  when 'none' then 'brand_created'
  when 'draft' then 'brand_created'
  when 'brand_created' then 'brand_created'
  when 'crawl_running' then 'crawl_running'
  when 'crawl_complete' then 'crawl_complete'
  when 'analysis_running' then 'analysis_running'
  when 'scores_complete' then 'scores_complete'
  when 'ready' then 'ready'
  when 'failed' then 'failed'
  else 'brand_created'
end;

alter table public.brands
  alter column intake_status type public.brand_intake_status
  using (
    case intake_status::text
      when 'approved' then 'ready'::public.brand_intake_status
      when 'none' then 'brand_created'::public.brand_intake_status
      when 'draft' then 'brand_created'::public.brand_intake_status
      when 'brand_created' then 'brand_created'::public.brand_intake_status
      when 'crawl_running' then 'crawl_running'::public.brand_intake_status
      when 'crawl_complete' then 'crawl_complete'::public.brand_intake_status
      when 'analysis_running' then 'analysis_running'::public.brand_intake_status
      when 'scores_complete' then 'scores_complete'::public.brand_intake_status
      when 'ready' then 'ready'::public.brand_intake_status
      when 'failed' then 'failed'::public.brand_intake_status
      else 'brand_created'::public.brand_intake_status
    end
  );

alter table public.brands
  alter column intake_status set default 'brand_created'::public.brand_intake_status;

alter table public.brands
  alter column intake_status set not null;

update public.brands
set instagram_handle = ai_profile->>'instagram_handle'
where instagram_handle is null
  and ai_profile->>'instagram_handle' is not null;

create index if not exists brands_instagram_handle_idx
  on public.brands (instagram_handle)
  where instagram_handle is not null;

create index if not exists brands_intake_status_idx
  on public.brands (intake_status);

alter table public.brand_scores
  add column if not exists score_version int not null default 1;

alter table public.brand_scores
  add column if not exists source text not null default 'edge_fn';

alter table public.brand_scores
  drop constraint if exists brand_scores_source_check;

alter table public.brand_scores
  add constraint brand_scores_source_check
  check (source in ('edge_fn', 'mastra_agent', 'manual', 'benchmarked', 'firecrawl'));

comment on column public.brand_scores.score_version is
  'Increments on each full re-analysis run. Enables trend charts per version.';
comment on column public.brand_scores.source is
  'Discriminates edge_fn, mastra_agent, manual, benchmarked, firecrawl.';

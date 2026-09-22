-- IPI-1307 · BRAND-INTEL-OFFICIAL-BASE-001
-- Proves the existing webhook claim table prevents duplicate terminal work.
-- This test is local-only and rolls back every fixture.

begin;

do $$
declare
  v_job text := 'ipi1307-job-' || gen_random_uuid()::text;
  v_first text := 'ipi1307-webhook-' || gen_random_uuid()::text;
  v_second text := 'ipi1307-webhook-' || gen_random_uuid()::text;
  v_count integer;
begin
  insert into public.processed_firecrawl_webhooks (
    webhook_id,
    firecrawl_job_id,
    event_type,
    status
  ) values (
    v_first,
    v_job,
    'crawl.completed',
    'processed'
  );

  begin
    insert into public.processed_firecrawl_webhooks (
      webhook_id,
      firecrawl_job_id,
      event_type,
      status
    ) values (
      v_second,
      v_job,
      'crawl.completed',
      'processing'
    );
    raise exception 'IPI-1307 FAIL: duplicate terminal job+event was accepted';
  exception
    when unique_violation then
      null;
  end;

  select count(*)
    into v_count
    from public.processed_firecrawl_webhooks
   where firecrawl_job_id = v_job
     and event_type = 'crawl.completed';

  if v_count <> 1 then
    raise exception 'IPI-1307 FAIL: expected one terminal claim, found %', v_count;
  end if;
  raise notice 'IPI-1307 firecrawl terminal dedupe PASS';
end $$;

rollback;
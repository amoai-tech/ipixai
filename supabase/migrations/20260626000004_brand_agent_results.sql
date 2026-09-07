-- IPI-26 — brand_agent_results (Mastra / Gemini agent run log)

create table if not exists public.brand_agent_results (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid references public.brands(id) on delete cascade,
  agent_name    text not null,
  agent_version text,
  model         text,
  run_id        text,
  status        text check (status in ('running', 'complete', 'failed')),
  output        jsonb not null default '{}',
  confidence    numeric(5, 2),
  tokens_in     int,
  tokens_out    int,
  duration_ms   int,
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists brand_agent_results_brand_id_idx
  on public.brand_agent_results (brand_id);

create index if not exists brand_agent_results_agent_name_idx
  on public.brand_agent_results (agent_name, created_at desc);

alter table public.brand_agent_results enable row level security;

drop policy if exists "agent_results_select_org_member" on public.brand_agent_results;

create policy "agent_results_select_org_member"
  on public.brand_agent_results for select to authenticated
  using (
    brand_id is null
    or exists (
      select 1 from public.brands b
      where b.id = brand_agent_results.brand_id
        and public.is_org_member(b.org_id)
    )
  );

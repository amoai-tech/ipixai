-- Context Engineering: agent_context_snapshots + agent_decision_log
-- Implements: semantic memory, compaction store, decision audit trail
-- Linear: CE-001

create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- agent_context_snapshots — context windows with Gemini embeddings
-- ---------------------------------------------------------------------------
create table if not exists public.agent_context_snapshots (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  brand_id         uuid references public.brands(id) on delete set null,
  session_id       text not null,
  agent_name       text not null,
  task_type        text not null,
  snapshot_type    text not null
    check (snapshot_type in ('task_start', 'compaction', 'task_end', 'decision')),
  content          jsonb not null default '{}',
  summary          text,
  token_estimate   int,
  embedding        vector(768),
  created_at       timestamptz not null default now()
);

create index if not exists agent_context_snapshots_user_session_idx
  on public.agent_context_snapshots (user_id, session_id, task_type);

-- hnsw works for small-to-medium datasets without pre-training
create index if not exists agent_context_snapshots_embedding_idx
  on public.agent_context_snapshots using hnsw (embedding vector_cosine_ops);

comment on table public.agent_context_snapshots is
  'Context Engineering: agent context windows with Gemini embeddings for semantic retrieval';

-- ---------------------------------------------------------------------------
-- agent_decision_log — append-only HITL audit trail
-- ---------------------------------------------------------------------------
create table if not exists public.agent_decision_log (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  brand_id       uuid references public.brands(id) on delete set null,
  session_id     text not null,
  agent_name     text,
  task_type      text,
  decision_type  text not null,
  decision       text not null
    check (decision in ('approved', 'rejected', 'revision_requested', 'deferred')),
  payload        jsonb,
  rationale      text,
  draft_id       uuid,
  approver_id    uuid references auth.users(id),
  created_at     timestamptz not null default now()
);

create index if not exists agent_decision_log_user_task_idx
  on public.agent_decision_log (user_id, task_type, created_at desc);

comment on table public.agent_decision_log is
  'Append-only HITL audit trail — no UPDATE or DELETE permitted by design';

-- ---------------------------------------------------------------------------
-- RLS — snapshots: service role writes, user reads own
-- ---------------------------------------------------------------------------
alter table public.agent_context_snapshots enable row level security;

drop policy if exists "ctx_snapshots_select_own" on public.agent_context_snapshots;
create policy "ctx_snapshots_select_own"
  on public.agent_context_snapshots for select to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- RLS — decisions: service role writes, user reads own
-- ---------------------------------------------------------------------------
alter table public.agent_decision_log enable row level security;

drop policy if exists "decision_log_select_own" on public.agent_decision_log;
create policy "decision_log_select_own"
  on public.agent_decision_log for select to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- search_context_snapshots — cosine similarity RPC (security definer)
-- ---------------------------------------------------------------------------
create or replace function public.search_context_snapshots(
  p_user_id   uuid,
  p_embedding vector(768),
  p_task_type text    default null,
  p_limit     int     default 5
)
returns table (
  id             uuid,
  session_id     text,
  agent_name     text,
  task_type      text,
  snapshot_type  text,
  content        jsonb,
  summary        text,
  token_estimate int,
  created_at     timestamptz,
  similarity     float
)
language sql stable security definer
set search_path = public
as $$
  select
    id, session_id, agent_name, task_type, snapshot_type,
    content, summary, token_estimate, created_at,
    1 - (embedding <=> p_embedding) as similarity
  from public.agent_context_snapshots
  where user_id = p_user_id
    and (p_task_type is null or task_type = p_task_type)
    and embedding is not null
  order by embedding <=> p_embedding
  limit p_limit;
$$;

-- Lock RPC to service_role — not callable via PostgREST by authenticated users
revoke execute on function public.search_context_snapshots(uuid, vector(768), text, int) from public;
grant  execute on function public.search_context_snapshots(uuid, vector(768), text, int) to service_role;

-- ---------------------------------------------------------------------------
-- Missing FK indexes (advisory from migration review)
-- ---------------------------------------------------------------------------
create index if not exists agent_context_snapshots_brand_id_idx
  on public.agent_context_snapshots (brand_id);

create index if not exists agent_decision_log_brand_id_idx
  on public.agent_decision_log (brand_id);

create index if not exists agent_decision_log_approver_id_idx
  on public.agent_decision_log (approver_id);

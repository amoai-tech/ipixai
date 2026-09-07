-- Brand Knowledge Graph: nodes, edges, embeddings, and search RPCs
-- Implements: GRAPH-001 (tables) + GRAPH-003 (brands.embedding) + GRAPH-004 (RPCs)
-- Linear: GRAPH-001 · GRAPH-003 · GRAPH-004
-- Dependencies: pgvector (already enabled in 20260621000000_context_engineering.sql)

-- ---------------------------------------------------------------------------
-- GRAPH-003: Add embedding column to brands
-- ---------------------------------------------------------------------------
alter table public.brands add column if not exists embedding vector(768);

create index if not exists brands_embedding_idx
  on public.brands using hnsw (embedding vector_cosine_ops);

comment on column public.brands.embedding is
  'Gemini text-embedding-004 768-dim vector for semantic brand search (GRAPH-003)';

-- ---------------------------------------------------------------------------
-- GRAPH-001: brand_graph_nodes — entities in the brand knowledge graph
-- ---------------------------------------------------------------------------
create table if not exists public.brand_graph_nodes (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references public.brands(id) on delete cascade,
  node_type   text not null check (node_type in (
    'brand', 'product', 'collection', 'persona', 'competitor',
    'social_account', 'designer', 'photographer', 'venue',
    'sponsor', 'campaign', 'value', 'color', 'font'
  )),
  label       text not null,
  description text,
  properties  jsonb not null default '{}',
  embedding   vector(768),
  external_id text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- One unique label per brand per node type
create unique index if not exists idx_graph_nodes_unique
  on public.brand_graph_nodes (brand_id, node_type, label);

-- Fast lookup: all nodes for a brand, filtered by type
create index if not exists idx_graph_nodes_brand
  on public.brand_graph_nodes (brand_id, node_type);

-- Vector similarity on node embeddings
create index if not exists idx_graph_nodes_embedding
  on public.brand_graph_nodes using hnsw (embedding vector_cosine_ops);

comment on table public.brand_graph_nodes is
  'Brand knowledge graph nodes — entities like colors, fonts, personas, competitors (GRAPH-001)';

-- ---------------------------------------------------------------------------
-- GRAPH-001: brand_graph_edges — relationships between graph nodes
-- ---------------------------------------------------------------------------
create table if not exists public.brand_graph_edges (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references public.brands(id) on delete cascade,
  source_node_id  uuid not null references public.brand_graph_nodes(id) on delete cascade,
  target_node_id  uuid not null references public.brand_graph_nodes(id) on delete cascade,
  edge_type       text not null check (edge_type in (
    'SELLS', 'TARGETS', 'COMPETES_WITH', 'INSPIRED_BY',
    'USES_COLOR', 'USES_FONT', 'POSTS_ON', 'FEATURES',
    'RECOMMENDS', 'HIRES', 'PARTNERS_WITH', 'SPONSORS'
  )),
  strength       real check (strength >= 0 and strength <= 1),
  properties     jsonb not null default '{}',
  created_at     timestamptz not null default now()
);

-- One edge per (source, target, type) — no duplicate connections
create unique index if not exists idx_graph_edges_unique
  on public.brand_graph_edges (source_node_id, target_node_id, edge_type);

-- Fast lookup: all edges for a brand
create index if not exists idx_graph_edges_brand
  on public.brand_graph_edges (brand_id);

-- Filter by relationship type (e.g. all COMPETES_WITH edges)
create index if not exists idx_graph_edges_type
  on public.brand_graph_edges (edge_type);

comment on table public.brand_graph_edges is
  'Brand knowledge graph edges — typed relationships between nodes (GRAPH-001)';

-- ---------------------------------------------------------------------------
-- RLS — brand_graph_nodes
-- ---------------------------------------------------------------------------
alter table public.brand_graph_nodes enable row level security;

-- Matches existing iPix pattern: org members can read, service_role writes
-- Uses is_org_member() defined in 20260624000000_ipi16_org_layer.sql
drop policy if exists "graph_nodes_select_via_brand" on public.brand_graph_nodes;
create policy "graph_nodes_select_via_brand"
  on public.brand_graph_nodes for select to authenticated
  using (
    exists (
      select 1 from public.brands b
      where b.id = brand_graph_nodes.brand_id
        and public.is_org_member(b.org_id)
    )
  );

drop policy if exists "graph_nodes_service_all" on public.brand_graph_nodes;
create policy "graph_nodes_service_all"
  on public.brand_graph_nodes for all to service_role
  using (true);

-- ---------------------------------------------------------------------------
-- RLS — brand_graph_edges
-- ---------------------------------------------------------------------------
alter table public.brand_graph_edges enable row level security;

drop policy if exists "graph_edges_select_via_brand" on public.brand_graph_edges;
create policy "graph_edges_select_via_brand"
  on public.brand_graph_edges for select to authenticated
  using (
    exists (
      select 1 from public.brands b
      where b.id = brand_graph_edges.brand_id
        and public.is_org_member(b.org_id)
    )
  );

drop policy if exists "graph_edges_service_all" on public.brand_graph_edges;
create policy "graph_edges_service_all"
  on public.brand_graph_edges for all to service_role
  using (true);

-- ---------------------------------------------------------------------------
-- GRAPH-004: search_brands — cosine similarity brand search
-- ---------------------------------------------------------------------------
-- Finds brands similar to a given embedding vector.
-- Returns similarity score + shared graph nodes for explainability.
create or replace function public.search_brands(
  p_embedding        vector(768),
  p_limit            int     default 20,
  p_exclude_brand_id uuid    default null
)
returns table (
  brand_id     uuid,
  brand_name   text,
  similarity   real,
  shared_nodes jsonb
)
language plpgsql stable security definer
set search_path = public
as $$
begin
  return query
  select
    b.id,
    b.name,
    1 - (b.embedding <=> p_embedding) as similarity,
    (
      select jsonb_agg(jsonb_build_object(
        'node_type', gn.node_type,
        'label', gn.label
      ))
      from public.brand_graph_nodes gn
      where gn.brand_id = b.id
        and gn.label in (
          select g2.label
          from public.brand_graph_nodes g2
          where (p_exclude_brand_id is null or g2.brand_id = p_exclude_brand_id)
        )
      limit 10
    ) as shared_nodes
  from public.brands b
  where b.embedding is not null
    and (p_exclude_brand_id is null or b.id != p_exclude_brand_id)
  order by b.embedding <=> p_embedding
  limit p_limit;
end;
$$;

revoke execute on function public.search_brands(vector(768), int, uuid) from public;
grant  execute on function public.search_brands(vector(768), int, uuid) to service_role;

comment on function public.search_brands is
  'Semantic brand search via pgvector cosine similarity (GRAPH-004)';

-- ---------------------------------------------------------------------------
-- GRAPH-004: traverse_brand_graph — N-hop graph traversal
-- ---------------------------------------------------------------------------
-- Starting from a node, follow edges up to p_max_hops deep.
-- Optional edge type filter limits which relationships to traverse.
create or replace function public.traverse_brand_graph(
  p_start_node_id uuid,
  p_max_hops      int     default 2,
  p_edge_types    text[]  default null
)
returns table (
  node_id    uuid,
  node_type  text,
  label      text,
  path_length int,
  edge_types text[]
)
language sql stable security definer
set search_path = public
as $$
  with recursive graph_walk as (
    -- Base: start node
    select
      id::uuid as node_id,
      node_type,
      label,
      0::int as path_length,
      '{}'::text[] as edge_types
    from public.brand_graph_nodes
    where id = p_start_node_id

    union all

    -- Recurse: follow edges outward
    select
      gn.id,
      gn.node_type,
      gn.label,
      gw.path_length + 1,
      gw.edge_types || ge.edge_type
    from graph_walk gw
    join public.brand_graph_edges ge
      on ge.source_node_id = gw.node_id
    join public.brand_graph_nodes gn
      on gn.id = ge.target_node_id
    where gw.path_length < p_max_hops
      and (p_edge_types is null or ge.edge_type = any(p_edge_types))
  )
  select distinct on (node_id)
    node_id, node_type, label, path_length, edge_types
  from graph_walk
  order by node_id, path_length;
$$;

revoke execute on function public.traverse_brand_graph(uuid, int, text[]) from public;
grant  execute on function public.traverse_brand_graph(uuid, int, text[]) to service_role;

comment on function public.traverse_brand_graph is
  'N-hop brand graph traversal with edge type filtering (GRAPH-004)';

-- Note: FK indexes on brand_id are covered by the composite indexes above
-- (idx_graph_nodes_brand covers brand_id queries via leftmost-column rule)

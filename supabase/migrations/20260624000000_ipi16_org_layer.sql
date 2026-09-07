-- IPI-16 · IPI2-189 — Multi-brand organization layer
-- Schema-only, non-destructive. brands.user_id kept as legacy.
-- Remote already has public.organizations (legacy FashionOS table, different schema).
-- We ALTER it to add owner_id + plan; create org_members; add brands.org_id.

-- ─────────────────────────────────────────────────────────────
-- 1. Extend existing organizations table
-- ─────────────────────────────────────────────────────────────
alter table public.organizations
  add column if not exists owner_id uuid references auth.users(id) on delete restrict,
  add column if not exists plan    text not null default 'free'
                                   check (plan in ('free', 'pro', 'agency'));

create index if not exists organizations_owner_id_idx
  on public.organizations (owner_id);

-- case-insensitive slug uniqueness (may already exist on legacy table — safe)
create unique index if not exists organizations_slug_lower_key
  on public.organizations (lower(slug));

-- updated_at trigger (moddatetime extension already loaded in this project)
drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.handle_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 2. org_members
-- ─────────────────────────────────────────────────────────────
create table if not exists public.org_members (
  org_id    uuid        not null references public.organizations(id) on delete cascade,
  user_id   uuid        not null references auth.users(id) on delete cascade,
  role      text        not null default 'viewer'
                        check (role in ('owner', 'editor', 'viewer')),
  joined_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index if not exists org_members_user_id_idx on public.org_members (user_id);
create index if not exists org_members_org_id_idx  on public.org_members (org_id);

-- ─────────────────────────────────────────────────────────────
-- 3. RLS helper functions — SECURITY DEFINER to avoid recursive
--    RLS when org_members policies reference org_members itself
-- ─────────────────────────────────────────────────────────────
create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.org_members
    where org_id  = p_org_id
      and user_id = (select auth.uid())
  );
$$;

create or replace function public.is_org_owner(p_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.org_members
    where org_id  = p_org_id
      and user_id = (select auth.uid())
      and role    = 'owner'
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. Add org_id to brands (nullable for backfill)
-- ─────────────────────────────────────────────────────────────
alter table public.brands
  add column if not exists org_id uuid
    references public.organizations(id) on delete restrict;

create index if not exists brands_org_id_idx on public.brands (org_id);

-- ─────────────────────────────────────────────────────────────
-- 5. Backfill: one org + one owner member per existing user_id
-- ─────────────────────────────────────────────────────────────
do $$
declare
  r            record;
  v_org_id     uuid;
  v_user_email text;
  v_slug       text;
begin
  for r in
    select distinct user_id from public.brands where org_id is null
  loop
    select email into v_user_email
    from auth.users where id = r.user_id;

    v_slug := lower(
      regexp_replace(
        split_part(coalesce(v_user_email, r.user_id::text), '@', 1),
        '[^a-z0-9]+', '-', 'g'
      )
    );

    -- ensure uniqueness
    if exists (select 1 from public.organizations where lower(slug) = v_slug) then
      v_slug := v_slug || '-' || substr(r.user_id::text, 1, 8);
    end if;

    -- create org, capture id
    insert into public.organizations (name, slug, owner_id, type)
    values (
      coalesce(v_user_email, 'My Organization'),
      v_slug,
      r.user_id,
      'brand'   -- required by legacy NOT NULL on type column
    )
    returning id into v_org_id;

    -- add owner to org_members
    insert into public.org_members (org_id, user_id, role)
    values (v_org_id, r.user_id, 'owner')
    on conflict do nothing;

    -- link brands to this org
    update public.brands
    set org_id = v_org_id
    where user_id = r.user_id and org_id is null;
  end loop;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 6. Set NOT NULL after backfill
-- ─────────────────────────────────────────────────────────────
alter table public.brands
  alter column org_id set not null;

-- ─────────────────────────────────────────────────────────────
-- 7. RLS — organizations
-- ─────────────────────────────────────────────────────────────
alter table public.organizations enable row level security;

drop policy if exists "orgs_select_member" on public.organizations;
drop policy if exists "orgs_insert_owner"  on public.organizations;
drop policy if exists "orgs_update_owner"  on public.organizations;
drop policy if exists "orgs_delete_owner"  on public.organizations;

create policy "orgs_select_member"
  on public.organizations for select to authenticated
  using (public.is_org_member(id));

create policy "orgs_insert_owner"
  on public.organizations for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "orgs_update_owner"
  on public.organizations for update to authenticated
  using  (public.is_org_owner(id))
  with check (public.is_org_owner(id));

create policy "orgs_delete_owner"
  on public.organizations for delete to authenticated
  using ((select auth.uid()) = owner_id);

-- ─────────────────────────────────────────────────────────────
-- 8. RLS — org_members
-- ─────────────────────────────────────────────────────────────
alter table public.org_members enable row level security;

create policy "org_members_select_member"
  on public.org_members for select to authenticated
  using (public.is_org_member(org_id));

create policy "org_members_insert_owner"
  on public.org_members for insert to authenticated
  with check (public.is_org_owner(org_id));

create policy "org_members_update_owner"
  on public.org_members for update to authenticated
  using  (public.is_org_owner(org_id))
  with check (public.is_org_owner(org_id));

-- members can leave; owners can remove anyone
create policy "org_members_delete"
  on public.org_members for delete to authenticated
  using (
    public.is_org_owner(org_id)
    or (select auth.uid()) = user_id
  );

-- ─────────────────────────────────────────────────────────────
-- 9. Update brands RLS — org-scoped (user_id column kept)
-- ─────────────────────────────────────────────────────────────
drop policy if exists "brands_select_own" on public.brands;
drop policy if exists "brands_insert_own" on public.brands;
drop policy if exists "brands_update_own" on public.brands;
drop policy if exists "brands_delete_own" on public.brands;

create policy "brands_select_org"
  on public.brands for select to authenticated
  using (public.is_org_member(org_id));

create policy "brands_insert_org"
  on public.brands for insert to authenticated
  with check (public.is_org_member(org_id));

create policy "brands_update_org"
  on public.brands for update to authenticated
  using  (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

-- only org owners can delete a brand
create policy "brands_delete_org"
  on public.brands for delete to authenticated
  using (public.is_org_owner(org_id));

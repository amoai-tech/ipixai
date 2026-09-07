-- ============================================================================
-- IPI2-160 · WEB-015.1 — Public chatbot + lead-draft schema (Phase 0)
-- ============================================================================
-- Persists the public homepage chatbot's conversations, transcript, funnel
-- events, and the claimable lead-draft hand-off artifact (WEB-015 epic).
--
-- Trust model (matches IPI2-116/IPI2-84 "no silent writes"):
--   * All writes go through the service-role `capture-lead` edge fn (IPI2-161),
--     which BYPASSES RLS. There are NO client INSERT/UPDATE/DELETE policies.
--   * RLS is default-deny on all 4 tables. The only client-facing read is:
--     an authenticated user may SELECT their OWN claimed lead draft.
--   * Anonymous visitors never touch these tables directly — RLS returns them
--     zero rows.
--   * A visitor's anonymous draft is transferred to their account exactly once
--     via claim_lead_draft() — a SECURITY DEFINER RPC with a single-use,
--     expirable secret token (anti-hijack), hardened with `search_path = ''`.
--
-- Additive + public-schema (consistent with brands/assets platform tables).
-- Rollback: drop function + drop the 4 tables (cascade), then re-apply.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.chatbot_conversations (
  id          uuid primary key default gen_random_uuid(),
  anon_id     text not null,                                   -- client-generated, pre-auth
  user_id     uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.chatbot_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.chatbot_conversations (id) on delete cascade,
  role             text not null check (role in ('user', 'assistant', 'system')),
  content          text not null,
  created_at       timestamptz not null default now()
);

create table if not exists public.chatbot_events (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid references public.chatbot_conversations (id) on delete cascade,
  type             text not null,                              -- opened, intent_detected, ... (no PII)
  payload          jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

create table if not exists public.lead_intake_drafts (
  id                      uuid primary key default gen_random_uuid(),
  conversation_id         uuid references public.chatbot_conversations (id) on delete set null,
  user_id                 uuid references auth.users (id) on delete set null,  -- null until claimed
  status                  text not null default 'draft' check (status in ('draft', 'ready', 'claimed')),
  answers                 jsonb not null default '{}'::jsonb,
  claim_token             text,                                -- secret, single-use; cleared on claim
  claim_token_expires_at  timestamptz,
  claimed_at              timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists chatbot_messages_conversation_idx on public.chatbot_messages (conversation_id);
create index if not exists chatbot_events_conversation_idx    on public.chatbot_events (conversation_id);
create index if not exists lead_drafts_conversation_idx       on public.lead_intake_drafts (conversation_id);
create index if not exists lead_drafts_user_idx               on public.lead_intake_drafts (user_id);

comment on table public.chatbot_conversations is 'Public homepage chatbot sessions (WEB-015). anon_id is pre-auth; user_id is set when the visitor logs in and claims their draft.';
comment on table public.chatbot_messages is 'Transcript turns for a chatbot conversation. Service-role write only; RLS default-deny.';
comment on table public.chatbot_events is 'Funnel/telemetry events for the chatbot (no PII in payload). Service-role write only; RLS default-deny.';
comment on table public.lead_intake_drafts is 'Claimable lead-draft hand-off from the public chatbot to Brand Intake (IPI2-83). Anonymous until claim_lead_draft() transfers ownership to the caller.';

-- uuid PKs (not identity) are deliberate: anonymous drafts must be non-enumerable
-- so a sequential id cannot leak draft existence/volume to unauthenticated callers.

-- ---------------------------------------------------------------------------
-- RLS — default-deny everywhere; one owner-read policy on lead drafts
-- ---------------------------------------------------------------------------
alter table public.chatbot_conversations enable row level security;
alter table public.chatbot_messages      enable row level security;
alter table public.chatbot_events        enable row level security;
alter table public.lead_intake_drafts    enable row level security;

-- No policies on conversations/messages/events → service-role-only (RLS denies
-- anon + authenticated). The client reads its own chat through the public
-- runtime, never these tables directly.

-- The single client-facing read: an authenticated user sees only their own
-- claimed draft (user_id is set exactly once, by claim_lead_draft()).
create policy "lead drafts: owner can read own"
  on public.lead_intake_drafts
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Grants — service-role writes everything; authenticated only reads own draft
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.chatbot_conversations to service_role;
grant select, insert, update, delete on public.chatbot_messages      to service_role;
grant select, insert, update, delete on public.chatbot_events        to service_role;
grant select, insert, update, delete on public.lead_intake_drafts    to service_role;
grant select on public.lead_intake_drafts to authenticated;

-- ---------------------------------------------------------------------------
-- claim_lead_draft — transfer an anonymous draft to the caller, once.
-- SECURITY DEFINER (must bypass RLS to set ownership) + hardened search_path.
-- Atomic guarded UPDATE rejects: not-authenticated, wrong token, expired token,
-- and already-claimed (double-claim) — all collapse to "invalid or expired".
-- ---------------------------------------------------------------------------
create or replace function public.claim_lead_draft(p_draft_id uuid, p_claim_token text)
returns public.lead_intake_drafts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_draft public.lead_intake_drafts;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  update public.lead_intake_drafts d
     set user_id     = v_uid,
         status      = 'claimed',
         claim_token = null,
         claimed_at  = now(),
         updated_at  = now()
   where d.id = p_draft_id
     and d.user_id is null                                        -- double-claim guard
     and d.claim_token is not null
     and d.claim_token = p_claim_token                            -- wrong-token guard
     and (d.claim_token_expires_at is null
          or d.claim_token_expires_at > now())                    -- expiry guard
  returning d.* into v_draft;

  if not found then
    raise exception 'invalid or expired claim token' using errcode = 'P0001';
  end if;

  return v_draft;
end;
$$;

revoke all on function public.claim_lead_draft(uuid, text) from public, anon;
grant execute on function public.claim_lead_draft(uuid, text) to authenticated;

comment on function public.claim_lead_draft(uuid, text) is 'Transfers an anonymous lead draft to the authenticated caller exactly once, via a single-use, expirable token. SECURITY DEFINER (must bypass RLS to set ownership); hardened with an empty search_path.';

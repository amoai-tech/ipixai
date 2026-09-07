-- Phase 2: High Priority Fix #3
-- Add missing indexes on foreign key columns

begin;

-- Add index for amazon_connections.user_id → profiles.id
create index if not exists idx_amazon_connections_user_id
on public.amazon_connections(user_id)
where user_id is not null;

-- Add index for facebook_connections.user_id → profiles.id
create index if not exists idx_facebook_connections_user_id
on public.facebook_connections(user_id)
where user_id is not null;

-- Add index for instagram_connections.user_id → profiles.id
create index if not exists idx_instagram_connections_user_id
on public.instagram_connections(user_id)
where user_id is not null;

-- Verify organizer_team_members.user_id has index (should already exist, but verify)
create index if not exists idx_organizer_team_members_user_id
on public.organizer_team_members(user_id)
where user_id is not null;

-- Verify shoot_payments.user_id has index (should already exist, but verify)
create index if not exists idx_shoot_payments_user_id
on public.shoot_payments(user_id)
where user_id is not null;

commit;;

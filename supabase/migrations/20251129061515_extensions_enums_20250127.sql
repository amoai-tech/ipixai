-- ============================================================================
-- Migration: Extensions and Enums (20250127)
-- Purpose: Enable required extensions and define all enum types for FashionOS
-- Affected: Extensions, Enum types
-- ============================================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- Enable pg_trgm for fuzzy text search (useful for search functionality)
create extension if not exists "pg_trgm";

-- ============================================================================
-- ENUMS
-- ============================================================================

-- User roles in the system
do $$ begin
    create type user_role as enum (
      'designer',
      'studio_admin',
      'organizer',
      'photographer',
      'model',
      'attendee',
      'admin'
    );
    comment on type user_role is 'User roles in the FashionOS platform';
exception when duplicate_object then null;
end $$;

-- Shoot service types
do $$ begin
    create type shoot_service_type as enum ('photo', 'video', 'hybrid');
    comment on type shoot_service_type is 'Type of shoot service requested';
exception when duplicate_object then null;
end $$;

-- Shoot status lifecycle
do $$ begin
    create type shoot_status as enum (
      'draft',
      'ready_for_payment',
      'confirmed',
      'shooting',
      'editing',
      'delivered',
      'cancelled'
    );
    comment on type shoot_status is 'Lifecycle status of a shoot booking';
exception when duplicate_object then null;
end $$;

-- Location types for shoots
do $$ begin
    create type location_mode as enum ('virtual', 'studio', 'hybrid');
    comment on type location_mode is 'Location type for shoot execution';
exception when duplicate_object then null;
end $$;

-- Payment status (check if exists first, may need to add 'succeeded' if missing)
do $$ begin
    create type payment_status as enum ('pending', 'paid', 'refunded', 'failed', 'succeeded');
    comment on type payment_status is 'Status of payment transactions';
exception when duplicate_object then 
    -- If exists, check if we need to add 'succeeded'
    if not exists (
        select 1 from pg_enum 
        where enumlabel = 'succeeded' 
        and enumtypid = (select oid from pg_type where typname = 'payment_status')
    ) then
        alter type payment_status add value 'succeeded';
    end if;
end $$;

-- Asset types
do $$ begin
    create type asset_type as enum ('image', 'video', 'document');
    comment on type asset_type is 'Type of media asset';
exception when duplicate_object then null;
end $$;

-- Distribution channels for shoots
do $$ begin
    create type distribution_channel as enum (
      'instagram_feed',
      'instagram_reels',
      'instagram_stories',
      'tiktok',
      'youtube',
      'amazon_listing',
      'shopify_pdp',
      'facebook',
      'pinterest',
      'email_campaign',
      'print'
    );
    comment on type distribution_channel is 'Channels where shoot assets will be used';
exception when duplicate_object then null;
end $$;

-- Shot style types
do $$ begin
    create type shot_style_type as enum (
      'packshot',
      'flat_lay',
      'on_model',
      'lifestyle',
      'detail',
      'creative_splash',
      'editorial',
      'beauty'
    );
    comment on type shot_style_type is 'Visual style of individual shots';
exception when duplicate_object then null;
end $$;

-- Talent types
do $$ begin
    create type talent_type as enum ('hand', 'full_body', 'pet', 'none');
    comment on type talent_type is 'Type of talent/model required';
exception when duplicate_object then null;
end $$;

-- Event types
do $$ begin
    create type event_type as enum (
      'runway_show',
      'presentation',
      'pop_up',
      'trunk_show',
      'workshop',
      'networking',
      'party'
    );
    comment on type event_type is 'Type of fashion event';
exception when duplicate_object then null;
end $$;

-- Event status lifecycle
do $$ begin
    create type event_status as enum (
      'draft',
      'published',
      'live',
      'completed',
      'cancelled',
      'review',
      'sold_out'
    );
    comment on type event_status is 'Lifecycle status of an event';
exception when duplicate_object then 
    -- Add missing values if enum exists
    if not exists (
        select 1 from pg_enum 
        where enumlabel = 'review' 
        and enumtypid = (select oid from pg_type where typname = 'event_status')
    ) then
        alter type event_status add value 'review';
    end if;
    if not exists (
        select 1 from pg_enum 
        where enumlabel = 'sold_out' 
        and enumtypid = (select oid from pg_type where typname = 'event_status')
    ) then
        alter type event_status add value 'sold_out';
    end if;
end $$;

-- Registration status
do $$ begin
    create type registration_status as enum (
      'registered',
      'waitlist',
      'checked_in',
      'cancelled',
      'no_show',
      'pending',
      'confirmed',
      'refunded'
    );
    comment on type registration_status is 'Status of event registration';
exception when duplicate_object then 
    -- Add missing values
    if not exists (select 1 from pg_enum where enumlabel = 'pending' and enumtypid = (select oid from pg_type where typname = 'registration_status')) then
        alter type registration_status add value 'pending';
    end if;
    if not exists (select 1 from pg_enum where enumlabel = 'confirmed' and enumtypid = (select oid from pg_type where typname = 'registration_status')) then
        alter type registration_status add value 'confirmed';
    end if;
    if not exists (select 1 from pg_enum where enumlabel = 'refunded' and enumtypid = (select oid from pg_type where typname = 'registration_status')) then
        alter type registration_status add value 'refunded';
    end if;
end $$;

-- Registration types
do $$ begin
    create type registration_type as enum ('general', 'vip', 'media', 'buyer', 'staff');
    comment on type registration_type is 'Type of event registration';
exception when duplicate_object then null;
end $$;

-- Season types for collections
do $$ begin
    create type season_type as enum (
      'ss',
      'aw',
      'resort',
      'pre_fall',
      'bridal',
      'capsule'
    );
    comment on type season_type is 'Fashion season classification';
exception when duplicate_object then null;
end $$;
;

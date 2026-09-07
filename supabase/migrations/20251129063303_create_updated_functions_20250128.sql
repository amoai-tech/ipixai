-- ============================================================================
-- Migration: Create Updated Database Functions
-- Purpose: Reusable database functions updated to match current schema
-- Affected: Database functions
-- Dependencies: public.shoots, public.profiles, service_type, shoot_status_v2 enums
-- Note: Updated to use service_type and shoot_status_v2 instead of old enum names
-- ============================================================================

-- Function: Get user's shoots with status filter
-- Updated to use service_type and shoot_status_v2 enums
-- Updated to match actual shoots table structure (scheduled_date, scheduled_time, estimated_quote)
create or replace function public.get_user_shoots(
  user_id uuid,
  status_filter shoot_status_v2 default null
)
returns table (
  id uuid,
  shoot_type service_type,
  fashion_category text,
  status shoot_status_v2,
  scheduled_date date,
  scheduled_time time,
  estimated_quote numeric,
  created_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
stable
as $$
begin
  return query
  select
    s.id,
    s.shoot_type,
    s.fashion_category,
    s.status,
    s.scheduled_date,
    s.scheduled_time,
    s.estimated_quote,
    s.created_at
  from public.shoots s
  where s.designer_id = get_user_shoots.user_id
    and (get_user_shoots.status_filter is null or s.status = get_user_shoots.status_filter)
  order by s.created_at desc;
end;
$$;
comment on function public.get_user_shoots(uuid, shoot_status_v2) is 'Get all shoots for a user, optionally filtered by status (Service Booking System)';

-- Function: Calculate shoot price based on parameters
-- Updated to use service_type enum instead of shoot_service_type
-- Updated enum values: 'photography', 'video', 'hybrid' (not 'photo', 'video', 'hybrid')
create or replace function public.calculate_shoot_price(
  p_shoot_type service_type,
  p_looks_count integer,
  p_fulfillment_type text default null,
  p_retouching_level retouching_level default 'basic'
)
returns numeric
language plpgsql
security invoker
set search_path = ''
immutable
as $$
declare
  base_price numeric := 0;
  looks_multiplier numeric := 1.0;
  fulfillment_multiplier numeric := 1.0;
  retouching_multiplier numeric := 1.0;
begin
  -- Base prices by shoot type (Service Booking System)
  case p_shoot_type
    when 'photography' then base_price := 500;
    when 'video' then base_price := 1000;
    when 'hybrid' then base_price := 1200;
  end case;
  
  -- Looks multiplier (bulk discount)
  if p_looks_count > 10 then
    looks_multiplier := 0.85;
  elsif p_looks_count > 5 then
    looks_multiplier := 0.90;
  end if;
  
  -- Fulfillment multiplier (virtual is cheaper)
  if p_fulfillment_type = 'virtual' then
    fulfillment_multiplier := 0.75;
  end if;
  
  -- Retouching multiplier (high_end costs more)
  if p_retouching_level = 'high_end' then
    retouching_multiplier := 1.25;
  end if;
  
  return round(base_price * p_looks_count * looks_multiplier * fulfillment_multiplier * retouching_multiplier, 2);
end;
$$;
comment on function public.calculate_shoot_price(service_type, integer, text, retouching_level) is 'Calculate estimated price for a shoot based on parameters (Service Booking System)';

-- Function: Get event registration count
-- Updated to use registrations table (not event_registrations)
-- Updated to use registration_status enum values
create or replace function public.get_event_registration_count(
  p_event_id uuid
)
returns integer
language plpgsql
security invoker
set search_path = ''
stable
as $$
declare
  reg_count integer;
begin
  -- Use registrations table (ticket-based registrations)
  select count(*)
  into reg_count
  from public.registrations
  where event_id = p_event_id
    and status in ('confirmed', 'checked_in');
  
  return coalesce(reg_count, 0);
end;
$$;
comment on function public.get_event_registration_count(uuid) is 'Get count of active registrations for an event (uses registrations table)';
;

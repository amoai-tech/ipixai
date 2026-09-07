-- ============================================================================
-- Migration: Create Shoot Payments Table (Service Booking System) - FIXED
-- Purpose: Financial audit trail for shoot bookings
-- Affected: public.shoot_payments table (separate from event payments)
-- Dependencies: public.shoots, auth.users, payment_status enum
-- Note: This aligns with the Service Booking System spec (Version 1.0)
-- Note: payment_status enum already exists, reusing it
-- ============================================================================

-- Shoot Payments: Audit Trail (User Spec)
CREATE TABLE IF NOT EXISTS public.shoot_payments (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  shoot_id uuid REFERENCES public.shoots(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  amount decimal(10, 2) NOT NULL,
  provider_payment_id text, -- Stripe ID
  status payment_status DEFAULT 'pending',
  created_at timestamptz DEFAULT now() NOT NULL,
  
  -- Constraints
  CONSTRAINT shoot_payments_amount_check CHECK (amount > 0)
);

COMMENT ON TABLE public.shoot_payments IS 'Payment transactions for shoot bookings, integrated with Stripe (Service Booking System)';
COMMENT ON COLUMN public.shoot_payments.shoot_id IS 'Foreign key to the shoots table.';
COMMENT ON COLUMN public.shoot_payments.user_id IS 'User who made the payment.';
COMMENT ON COLUMN public.shoot_payments.amount IS 'Payment amount.';
COMMENT ON COLUMN public.shoot_payments.provider_payment_id IS 'ID from the payment provider (e.g., Stripe).';
COMMENT ON COLUMN public.shoot_payments.status IS 'Payment status: pending, succeeded, failed, refunded.';

-- Indexes for performance (idempotent)
CREATE INDEX IF NOT EXISTS idx_shoot_payments_shoot_id ON public.shoot_payments(shoot_id);
CREATE INDEX IF NOT EXISTS idx_shoot_payments_user_id ON public.shoot_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_shoot_payments_status ON public.shoot_payments(status);
CREATE INDEX IF NOT EXISTS idx_shoot_payments_provider_id ON public.shoot_payments(provider_payment_id) WHERE provider_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shoot_payments_created_at ON public.shoot_payments(created_at DESC);

-- Enable RLS (idempotent)
ALTER TABLE public.shoot_payments ENABLE ROW LEVEL SECURITY;
;

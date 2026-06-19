-- EvalAI Supabase setup: tables, RLS, signup trigger, storage buckets
-- Run this in Supabase Dashboard → SQL Editor → New query → Run

-- =============================================================================
-- STEP 5: TABLES
-- =============================================================================

-- 1. profiles — one row per user (plan, subscription)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  subscription_status TEXT NOT NULL DEFAULT 'none'
    CHECK (subscription_status IN ('none', 'active', 'canceled', 'past_due')),
  pro_since TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. evaluations — transcript upload & PDF report history
CREATE TABLE IF NOT EXISTS public.evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title TEXT,
  original_filename TEXT,
  content_type TEXT NOT NULL CHECK (content_type IN ('text/plain', 'text/markdown')),
  transcript_path TEXT NOT NULL,
  report_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  evaluation_summary JSONB,
  file_size_bytes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS evaluations_user_id_created_at_idx
  ON public.evaluations (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS evaluations_user_id_status_idx
  ON public.evaluations (user_id, status);

-- 3. usage_counters — free tier: 5 uploads per calendar month
CREATE TABLE IF NOT EXISTS public.usage_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  month_key TEXT NOT NULL,
  upload_count INTEGER NOT NULL DEFAULT 0 CHECK (upload_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, month_key)
);

CREATE INDEX IF NOT EXISTS usage_counters_user_id_month_key_idx
  ON public.usage_counters (user_id, month_key);

-- Auto-create profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    trim(concat_ws(
      ' ',
      NEW.raw_user_meta_data->>'first_name',
      NEW.raw_user_meta_data->>'last_name'
    ))
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Keep updated_at in sync
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS usage_counters_set_updated_at ON public.usage_counters;
CREATE TRIGGER usage_counters_set_updated_at
  BEFORE UPDATE ON public.usage_counters
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Users cannot change plan/subscription from the client (only service_role / backend)
CREATE OR REPLACE FUNCTION public.protect_profile_subscription_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    NEW.plan := OLD.plan;
    NEW.subscription_status := OLD.subscription_status;
    NEW.pro_since := OLD.pro_since;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_subscription_fields ON public.profiles;
CREATE TRIGGER protect_profile_subscription_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_subscription_fields();

-- =============================================================================
-- STEP 6: ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- evaluations (read only from client; writes via Next.js / worker service role)
DROP POLICY IF EXISTS "Users can read own evaluations" ON public.evaluations;
CREATE POLICY "Users can read own evaluations"
  ON public.evaluations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- usage_counters (read only from client)
DROP POLICY IF EXISTS "Users can read own usage" ON public.usage_counters;
CREATE POLICY "Users can read own usage"
  ON public.usage_counters FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- =============================================================================
-- STEP 7: STORAGE BUCKETS + POLICIES
-- Path format: {user_id}/{evaluation_id}/filename
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'transcripts',
  'transcripts',
  false,
  2097152,
  ARRAY['text/plain', 'text/markdown', 'text/x-markdown', 'application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reports',
  'reports',
  false,
  10485760,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- transcripts: users read/upload only in their folder
DROP POLICY IF EXISTS "Users read own transcripts" ON storage.objects;
CREATE POLICY "Users read own transcripts"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'transcripts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users upload own transcripts" ON storage.objects;
CREATE POLICY "Users upload own transcripts"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'transcripts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- reports: users read only (PDFs written by backend service role)
DROP POLICY IF EXISTS "Users read own reports" ON storage.objects;
CREATE POLICY "Users read own reports"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'reports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

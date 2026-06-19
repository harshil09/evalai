-- Optional model reported by user at upload (cost comparison reference)
-- Run in Supabase Dashboard → SQL Editor after migration_model_catalog.sql

ALTER TABLE public.evaluations
  ADD COLUMN IF NOT EXISTS user_reported_model TEXT;

CREATE INDEX IF NOT EXISTS evaluations_user_reported_model_idx
  ON public.evaluations (user_reported_model)
  WHERE user_reported_model IS NOT NULL;

-- Replace job creator to accept optional model (validates against active catalog)
DROP FUNCTION IF EXISTS public.create_evaluation_job(UUID, TEXT, TEXT, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.create_evaluation_job(
  p_user_id UUID,
  p_title TEXT,
  p_original_filename TEXT,
  p_content_type TEXT,
  p_file_size_bytes INTEGER,
  p_user_reported_model TEXT DEFAULT NULL
)
RETURNS public.evaluations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan TEXT;
  v_month_key TEXT;
  v_upload_count INTEGER;
  v_evaluation_id UUID := gen_random_uuid();
  v_transcript_path TEXT;
  v_evaluation public.evaluations;
  v_model TEXT;
BEGIN
  SELECT plan INTO v_plan
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_plan IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  v_model := NULLIF(trim(p_user_reported_model), '');

  IF v_model IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.model_catalog
      WHERE model_id = v_model AND active = true
    ) THEN
      RAISE EXCEPTION 'Unknown or inactive model: %', v_model;
    END IF;
  END IF;

  v_month_key := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');

  IF v_plan = 'free' THEN
    SELECT upload_count INTO v_upload_count
    FROM public.usage_counters
    WHERE user_id = p_user_id AND month_key = v_month_key
    FOR UPDATE;

    IF v_upload_count IS NULL THEN
      INSERT INTO public.usage_counters (user_id, month_key, upload_count)
      VALUES (p_user_id, v_month_key, 0);
      v_upload_count := 0;
    END IF;

    IF v_upload_count >= 5 THEN
      RAISE EXCEPTION 'Monthly upload limit reached (5 per month on free plan)';
    END IF;
  END IF;

  v_transcript_path := p_user_id::text || '/' || v_evaluation_id::text || '/' || p_original_filename;

  INSERT INTO public.evaluations (
    id,
    user_id,
    title,
    original_filename,
    content_type,
    transcript_path,
    file_size_bytes,
    user_reported_model,
    status
  )
  VALUES (
    v_evaluation_id,
    p_user_id,
    p_title,
    p_original_filename,
    p_content_type,
    v_transcript_path,
    p_file_size_bytes,
    v_model,
    'pending'
  )
  RETURNING * INTO v_evaluation;

  INSERT INTO public.usage_counters (user_id, month_key, upload_count)
  VALUES (p_user_id, v_month_key, 1)
  ON CONFLICT (user_id, month_key)
  DO UPDATE SET upload_count = public.usage_counters.upload_count + 1;

  RETURN v_evaluation;
END;
$$;

REVOKE ALL ON FUNCTION public.create_evaluation_job(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_evaluation_job(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT) TO service_role;

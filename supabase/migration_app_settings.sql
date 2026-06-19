-- Global app settings for worker analysis (defaults, cache TTL)
-- Run in Supabase Dashboard → SQL Editor after migration_model_catalog.sql

CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS app_settings_set_updated_at ON public.app_settings;
CREATE TRIGGER app_settings_set_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read app settings" ON public.app_settings;
CREATE POLICY "Authenticated users can read app settings"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (true);

INSERT INTO public.app_settings (key, value, description)
VALUES
  (
    'default_reference_model',
    'gpt-4o',
    'Reference model for cost comparison when none is detected in the transcript'
  ),
  (
    'reserved_output_tokens',
    '4096',
    'Tokens reserved for model response when checking context-window fit'
  ),
  (
    'model_catalog_cache_seconds',
    '900',
    'How long the worker caches model_catalog and app_settings in memory (seconds)'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  updated_at = now();

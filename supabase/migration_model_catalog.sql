-- Dynamic model catalog for worker cost / fit analysis
-- Run in Supabase Dashboard → SQL Editor after schema.sql and migration_worker.sql

CREATE TABLE IF NOT EXISTS public.model_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  context_window INTEGER NOT NULL CHECK (context_window > 0),
  input_price_per_1m NUMERIC(12, 6) NOT NULL CHECK (input_price_per_1m >= 0),
  encoding TEXT NOT NULL DEFAULT 'cl100k_base',
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS model_catalog_active_sort_idx
  ON public.model_catalog (active, sort_order, model_id);

DROP TRIGGER IF EXISTS model_catalog_set_updated_at ON public.model_catalog;
CREATE TRIGGER model_catalog_set_updated_at
  BEFORE UPDATE ON public.model_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.model_catalog ENABLE ROW LEVEL SECURITY;

-- Read-only for signed-in users (future admin UI); writes via service_role / SQL editor
DROP POLICY IF EXISTS "Authenticated users can read active models" ON public.model_catalog;
CREATE POLICY "Authenticated users can read active models"
  ON public.model_catalog FOR SELECT
  TO authenticated
  USING (active = true);

-- Seed from bundled worker catalog (idempotent)
INSERT INTO public.model_catalog (
  model_id,
  provider,
  context_window,
  input_price_per_1m,
  encoding,
  active,
  sort_order
)
VALUES
  ('gpt-4o-mini', 'OpenAI', 128000, 0.15, 'o200k_base', true, 10),
  ('gpt-4o', 'OpenAI', 128000, 2.5, 'o200k_base', true, 20),
  ('gpt-4.1-mini', 'OpenAI', 1047576, 0.4, 'o200k_base', true, 30),
  ('gpt-4.1', 'OpenAI', 1047576, 2.0, 'o200k_base', true, 40),
  ('claude-3-5-haiku', 'Anthropic', 200000, 0.8, 'cl100k_base', true, 50),
  ('claude-sonnet-4', 'Anthropic', 200000, 3.0, 'cl100k_base', true, 60),
  ('gemini-2.0-flash', 'Google', 1048576, 0.1, 'cl100k_base', true, 70),
  ('gemini-1.5-pro', 'Google', 2097152, 1.25, 'cl100k_base', true, 80),
  ('mistral-small', 'Mistral', 128000, 0.2, 'cl100k_base', true, 90),
  ('deepseek-chat', 'DeepSeek', 128000, 0.14, 'cl100k_base', true, 100)
ON CONFLICT (model_id) DO UPDATE SET
  provider = EXCLUDED.provider,
  context_window = EXCLUDED.context_window,
  input_price_per_1m = EXCLUDED.input_price_per_1m,
  encoding = EXCLUDED.encoding,
  active = EXCLUDED.active,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

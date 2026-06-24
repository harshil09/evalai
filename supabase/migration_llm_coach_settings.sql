-- LLM coach feature flags for hybrid prompting analysis
-- Run in Supabase Dashboard → SQL Editor after migration_app_settings.sql
-- value column is TEXT (see migration_app_settings.sql)

INSERT INTO public.app_settings (key, value, description)
VALUES
  (
    'enable_llm_coach',
    'false',
    'When true, worker enriches flagged turns via OpenRouter (requires OPENROUTER_API_KEY on worker). Worker .env ENABLE_LLM_COACH overrides this when set.'
  ),
  (
    'llm_coach_model',
    'openai/gpt-4o-mini',
    'OpenRouter chat model slug for turn-level coaching enrichment'
  ),
  (
    'embedding_model',
    'openai/text-embedding-3-small',
    'OpenRouter embedding model slug for redundancy similarity stage'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  updated_at = now();

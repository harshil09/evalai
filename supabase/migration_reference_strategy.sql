-- Reference model strategy for cost comparisons (Phase 2).
-- task_tier = compare against model recommended for detected task complexity
-- legacy = previous behavior (default gpt-4o when not reported/detected)

INSERT INTO public.app_settings (key, value, description)
VALUES (
  'reference_strategy',
  'task_tier',
  'Reference model selection: task_tier (recommended) or legacy (default model fallback)'
)
ON CONFLICT (key) DO NOTHING;

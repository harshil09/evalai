from supabase import Client, create_client

from worker.config import get_settings


PLACEHOLDER_MARKERS = ("your-project", "your-service-role-key", "your-anon")


def get_supabase_client() -> Client:
    settings = get_settings()
    url = settings["supabase_url"]
    key = settings["supabase_service_role_key"]

    if not url or not key:
        raise RuntimeError(
            "Missing Supabase credentials. Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) "
            "and SUPABASE_SERVICE_ROLE_KEY in worker/.env — copy real values from "
            "frontend/.env.local or Supabase Dashboard → Settings → API."
        )

    combined = f"{url} {key}".lower()
    if any(marker in combined for marker in PLACEHOLDER_MARKERS):
        raise RuntimeError(
            "worker/.env still has placeholder values from .env.example. "
            "Replace SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY with your project URL "
            "and service_role secret from Supabase Dashboard → Settings → API."
        )

    try:
        return create_client(url, key)
    except Exception as exc:
        if "Invalid API key" in str(exc):
            raise RuntimeError(
                "Supabase rejected SUPABASE_SERVICE_ROLE_KEY. Use the service_role secret "
                "(not the anon/publishable key) from Supabase Dashboard → Settings → API."
            ) from exc
        raise

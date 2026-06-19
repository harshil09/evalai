import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


def _env(*names: str, default: str = "") -> str:
    for name in names:
        value = os.getenv(name)
        if value:
            return value.strip()
    return default


@lru_cache
def get_settings() -> dict:
    return {
        "supabase_url": _env("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
        "supabase_service_role_key": _env("SUPABASE_SERVICE_ROLE_KEY"),
        "poll_interval_seconds": float(os.getenv("POLL_INTERVAL_SECONDS", "3")),
        "max_concurrent_jobs": int(os.getenv("MAX_CONCURRENT_JOBS", "2")),
        "reserved_output_tokens": int(os.getenv("RESERVED_OUTPUT_TOKENS", "4096")),
    }

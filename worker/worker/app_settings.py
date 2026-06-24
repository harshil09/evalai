from __future__ import annotations

import logging
import os
import time
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from worker.config import get_settings

if TYPE_CHECKING:
    from supabase import Client

logger = logging.getLogger(__name__)

KNOWN_KEYS = frozenset(
    {
        "default_reference_model",
        "reserved_output_tokens",
        "model_catalog_cache_seconds",
        "enable_llm_coach",
        "llm_coach_model",
        "embedding_model",
    }
)

_cache: dict[str, Any] | None = None


def _parse_bool(raw: Any) -> bool:
    if isinstance(raw, bool):
        return raw
    return str(raw).strip().lower() in ("1", "true", "yes")


def _parse_string_setting(raw: Any) -> str:
    """Normalize app_settings TEXT values (plain or JSON-quoted strings)."""
    text = str(raw).strip()
    if len(text) >= 2 and text[0] == '"' and text[-1] == '"':
        text = text[1:-1].strip()
    return text


def _env_defaults() -> dict:
    settings = get_settings()
    enable_llm = _parse_bool(os.getenv("ENABLE_LLM_COACH", "false"))
    return {
        "default_reference_model": os.getenv("DEFAULT_REFERENCE_MODEL", "gpt-4o").strip()
        or "gpt-4o",
        "reserved_output_tokens": settings["reserved_output_tokens"],
        "model_catalog_cache_seconds": int(settings["model_catalog_cache_seconds"]),
        "enable_llm_coach": enable_llm,
        "llm_coach_model": os.getenv("LLM_COACH_MODEL", "openai/gpt-4o-mini").strip()
        or "openai/gpt-4o-mini",
        "embedding_model": os.getenv(
            "EMBEDDING_MODEL", "openai/text-embedding-3-small"
        ).strip()
        or "openai/text-embedding-3-small",
    }


def _parse_settings(rows: list[dict]) -> dict:
    merged = _env_defaults()
    for row in rows:
        key = row.get("key")
        raw = row.get("value")
        if key not in KNOWN_KEYS or raw is None:
            continue
        try:
            if key == "default_reference_model":
                merged[key] = str(raw).strip() or merged[key]
            elif key == "reserved_output_tokens":
                merged[key] = max(0, int(raw))
            elif key == "model_catalog_cache_seconds":
                merged[key] = max(60, int(raw))
            elif key == "enable_llm_coach":
                merged[key] = _parse_bool(raw)
            elif key in ("llm_coach_model", "embedding_model"):
                parsed = _parse_string_setting(raw)
                if parsed:
                    merged[key] = parsed
        except (TypeError, ValueError) as exc:
            logger.warning("Ignoring invalid app_settings value for %s: %s", key, exc)

    # Worker .env wins for LLM coach knobs when explicitly set (local dev / deployment secrets).
    if os.getenv("ENABLE_LLM_COACH") is not None:
        merged["enable_llm_coach"] = _parse_bool(os.getenv("ENABLE_LLM_COACH"))
    if os.getenv("LLM_COACH_MODEL"):
        merged["llm_coach_model"] = os.getenv("LLM_COACH_MODEL", "").strip()
    if os.getenv("EMBEDDING_MODEL"):
        merged["embedding_model"] = os.getenv("EMBEDDING_MODEL", "").strip()

    return merged


def _load_from_supabase(client: Client) -> dict:
    response = (
        client.table("app_settings")
        .select("key, value")
        .in_("key", list(KNOWN_KEYS))
        .execute()
    )
    rows = response.data or []
    if not rows:
        raise ValueError("app_settings table has no known keys")
    return _parse_settings(rows)


def _cache_valid(cache_seconds: float) -> bool:
    if _cache is None:
        return False
    return (time.monotonic() - _cache["monotonic_at"]) < cache_seconds


def load_app_settings(
    client: Client | None = None,
    *,
    force_refresh: bool = False,
) -> tuple[dict, dict]:
    """
    Load global worker settings.

    Priority: in-memory cache → Supabase (when client provided) → env/code defaults.
    Returns (settings, metadata) where metadata includes source and fetched_at.
    """
    global _cache

    env_defaults = _env_defaults()
    cache_seconds = env_defaults["model_catalog_cache_seconds"]

    if not force_refresh and _cache_valid(cache_seconds):
        return _cache["settings"], dict(_cache["meta"])

    fetched_at = datetime.now(timezone.utc).isoformat()

    if client is not None:
        try:
            settings = _load_from_supabase(client)
            meta = {"source": "supabase", "fetched_at": fetched_at}
            _cache = {
                "settings": settings,
                "meta": meta,
                "monotonic_at": time.monotonic(),
            }
            logger.debug("Loaded app_settings from Supabase")
            return settings, meta
        except Exception as exc:
            logger.warning(
                "Could not load app_settings from Supabase (%s); using env defaults",
                exc,
            )

    settings = env_defaults
    meta = {"source": "env_fallback", "fetched_at": fetched_at}
    _cache = {
        "settings": settings,
        "meta": meta,
        "monotonic_at": time.monotonic(),
    }
    logger.debug("Loaded app_settings from env defaults")
    return settings, meta

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
    }
)

_cache: dict[str, Any] | None = None


def _env_defaults() -> dict:
    settings = get_settings()
    return {
        "default_reference_model": os.getenv("DEFAULT_REFERENCE_MODEL", "gpt-4o").strip()
        or "gpt-4o",
        "reserved_output_tokens": settings["reserved_output_tokens"],
        "model_catalog_cache_seconds": int(settings["model_catalog_cache_seconds"]),
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
        except (TypeError, ValueError) as exc:
            logger.warning("Ignoring invalid app_settings value for %s: %s", key, exc)
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

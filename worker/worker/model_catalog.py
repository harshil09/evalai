from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING, Any

from worker.config import get_settings

if TYPE_CHECKING:
    from supabase import Client

logger = logging.getLogger(__name__)

CATALOG_PATH = Path(__file__).parent / "model_catalog.json"

_cache: dict[str, Any] | None = None


def _load_from_file() -> list[dict]:
    with CATALOG_PATH.open(encoding="utf-8") as handle:
        return json.load(handle)


def _normalize_row(row: dict) -> dict:
    return {
        "model_id": row["model_id"],
        "provider": row["provider"],
        "context_window": int(row["context_window"]),
        "input_price_per_1m": float(row["input_price_per_1m"]),
        "encoding": row.get("encoding") or "cl100k_base",
    }


def _load_from_supabase(client: Client) -> list[dict]:
    response = (
        client.table("model_catalog")
        .select("model_id, provider, context_window, input_price_per_1m, encoding")
        .eq("active", True)
        .order("sort_order")
        .order("model_id")
        .execute()
    )
    rows = response.data or []
    if not rows:
        raise ValueError("model_catalog table has no active rows")
    return [_normalize_row(row) for row in rows]


def _cache_valid(cache_seconds: float) -> bool:
    if _cache is None:
        return False
    return (time.monotonic() - _cache["monotonic_at"]) < cache_seconds


def load_model_catalog(
    client: Client | None = None,
    *,
    force_refresh: bool = False,
    cache_seconds: float | None = None,
) -> tuple[list[dict], dict]:
    """
    Load active models for cost/fit analysis.

    Priority: in-memory cache → Supabase (when client provided) → bundled JSON fallback.
    Returns (catalog, metadata) where metadata includes source and fetched_at.
    """
    global _cache

    settings = get_settings()
    if cache_seconds is None:
        cache_seconds = settings["model_catalog_cache_seconds"]

    if not force_refresh and _cache_valid(cache_seconds):
        return _cache["catalog"], dict(_cache["meta"])

    fetched_at = datetime.now(timezone.utc).isoformat()

    if client is not None:
        try:
            catalog = _load_from_supabase(client)
            meta = {"source": "supabase", "fetched_at": fetched_at}
            _cache = {
                "catalog": catalog,
                "meta": meta,
                "monotonic_at": time.monotonic(),
            }
            logger.debug("Loaded %s model(s) from Supabase", len(catalog))
            return catalog, meta
        except Exception as exc:
            logger.warning(
                "Could not load model_catalog from Supabase (%s); using bundled JSON",
                exc,
            )

    catalog = _load_from_file()
    meta = {"source": "file_fallback", "fetched_at": fetched_at}
    _cache = {
        "catalog": catalog,
        "meta": meta,
        "monotonic_at": time.monotonic(),
    }
    logger.debug("Loaded %s model(s) from bundled JSON", len(catalog))
    return catalog, meta

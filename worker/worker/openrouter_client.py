"""OpenRouter client (OpenAI-compatible API) for optional LLM coaching."""

from __future__ import annotations

import logging
import os
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from openai import OpenAI

logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://openrouter.ai/api/v1"


def get_openrouter_api_key() -> str:
    return (os.getenv("OPENROUTER_API_KEY") or "").strip()


def get_openrouter_client() -> Any | None:
    """
    Return an OpenRouter-backed OpenAI SDK client, or None if unavailable.
    """
    api_key = get_openrouter_api_key()
    if not api_key:
        return None

    try:
        from openai import OpenAI
    except ImportError:
        logger.warning(
            "openai package not installed; LLM coach disabled. "
            "Run: pip install -r worker/requirements.txt"
        )
        return None

    base_url = (os.getenv("OPENROUTER_BASE_URL") or DEFAULT_BASE_URL).strip()

    headers: dict[str, str] = {}
    referer = (os.getenv("OPENROUTER_HTTP_REFERER") or "").strip()
    title = (os.getenv("OPENROUTER_APP_TITLE") or "EvalAI").strip()
    if referer:
        headers["HTTP-Referer"] = referer
    if title:
        headers["X-Title"] = title

    kwargs: dict = {"base_url": base_url, "api_key": api_key}
    if headers:
        kwargs["default_headers"] = headers
    return OpenAI(**kwargs)

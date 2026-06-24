"""Optional LLM enrichment for flagged prompting turns (feature-flagged)."""

from __future__ import annotations

import json
import logging
import os
from typing import Any

from pydantic import BaseModel, Field

from worker.openrouter_client import get_openrouter_client
from worker.parser import Turn

logger = logging.getLogger(__name__)


class TurnIssue(BaseModel):
    code: str
    confidence: float = Field(ge=0.0, le=1.0)
    summary: str


class TurnEnrichment(BaseModel):
    turn_index: int
    prompt_quality_score: int = Field(ge=0, le=100)
    issues: list[TurnIssue] = Field(default_factory=list)
    prompting_techniques: list[str] = Field(default_factory=list)
    why: str = ""
    suggested_prompt: str = ""
    redundant_with_turns: list[int] = Field(default_factory=list)
    redundancy_type: str | None = None


class TurnBatchResponse(BaseModel):
    turns: list[TurnEnrichment]


def _prior_user_turns(all_turns: list[Turn], turn_index: int, limit: int = 2) -> list[Turn]:
    prior: list[Turn] = []
    for turn in all_turns:
        if turn.role != "user":
            continue
        if turn.turn_index >= turn_index:
            break
        prior.append(turn)
    return prior[-limit:]


def _build_batch_prompt(
    batch: list[dict],
    all_turns: list[Turn],
    *,
    task_type: str,
    task_tier: str,
) -> str:
    lines = [
        "You are a prompting coach. Analyze flagged user turns and return JSON only.",
        f"Task type: {task_type}; complexity tier: {task_tier}.",
        "For each turn provide turn_index, prompt_quality_score (0-100), issues[], "
        "prompting_techniques[], why, suggested_prompt, redundant_with_turns[], redundancy_type.",
        "Be specific to the transcript — avoid generic templates for short dev commands.",
    ]
    for item in batch:
        turn_index = item["turn_index"]
        prior = _prior_user_turns(all_turns, turn_index)
        lines.append(f"\n--- Turn {turn_index} ---")
        lines.append(f"Rule flags: {', '.join(item.get('rule_flags', []))}")
        if item.get("redundant_with"):
            lines.append(f"Redundant with turns: {item['redundant_with']}")
        for p in prior:
            lines.append(f"Prior user turn {p.turn_index}: {p.content[:400]}")
        lines.append(f"Current: {item.get('content', '')[:800]}")
    lines.append('\nRespond with JSON: {"turns": [...]}')
    return "\n".join(lines)


def enrich_turn_suggestions(
    turns: list[Turn],
    rule_candidates: list[dict],
    redundancy_clusters: list[dict],
    *,
    task_type: str = "general",
    task_tier: str = "moderate",
    model: str | None = None,
    batch_size: int = 6,
) -> list[dict]:
    """
    Enrich flagged turns via structured LLM output (OpenRouter).
    Returns empty list on any failure or when OPENROUTER_API_KEY is missing.
    """
    client = get_openrouter_client()
    if client is None or not rule_candidates:
        return []

    coach_model = (
        model
        or os.getenv("LLM_COACH_MODEL", "openai/gpt-4o-mini").strip()
        or "openai/gpt-4o-mini"
    )

    redundancy_by_turn: dict[int, list[int]] = {}
    for cluster in redundancy_clusters:
        members = cluster.get("turn_indices", [])
        for turn_idx in members:
            redundancy_by_turn[turn_idx] = [m for m in members if m != turn_idx]

    flagged: list[dict] = []
    seen: set[int] = set()
    for candidate in rule_candidates:
        turn_index = candidate.get("turn_index")
        if turn_index is None or turn_index in seen:
            continue
        seen.add(turn_index)
        turn = next((t for t in turns if t.turn_index == turn_index and t.role == "user"), None)
        if turn is None:
            continue
        flagged.append(
            {
                "turn_index": turn_index,
                "content": turn.content,
                "rule_flags": candidate.get("possibly_issues", [candidate.get("issue", "")]),
                "redundant_with": redundancy_by_turn.get(turn_index, []),
            }
        )

    if not flagged:
        return []

    try:
        enriched: list[dict] = []

        for start in range(0, len(flagged), batch_size):
            batch = flagged[start : start + batch_size]
            prompt = _build_batch_prompt(batch, turns, task_type=task_type, task_tier=task_tier)
            response = client.chat.completions.create(
                model=coach_model,
                messages=[
                    {"role": "system", "content": "Respond with valid JSON only."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
                response_format={"type": "json_object"},
            )
            raw = response.choices[0].message.content or "{}"
            parsed = json.loads(raw)
            batch_result = TurnBatchResponse.model_validate(parsed)
            for turn_row in batch_result.turns:
                enriched.append(turn_row.model_dump())

        return enriched
    except Exception as exc:
        logger.warning("LLM coach enrichment failed: %s", exc)
        return []

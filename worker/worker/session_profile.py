"""Session-level scoring: prompt quality, token budget, and efficiency composite."""

from __future__ import annotations

from worker.parser import Turn
from worker.user_evaluation import (
    _score_context_management,
    _score_iteration,
    _score_problem_decomposition,
    _score_prompting_skills,
)

# User-token budgets by task tier (Phase 1 — user prompts only, not agent replies).
TIER_BASE_USER_TOKENS: dict[str, int] = {
    "simple": 800,
    "moderate": 2000,
    "complex": 5000,
}
TIER_PER_USER_TURN_TOKENS: dict[str, int] = {
    "simple": 150,
    "moderate": 250,
    "complex": 400,
}

EFFICIENCY_WEIGHTS = {
    "prompt": 0.45,
    "token": 0.35,
    "model": 0.20,
}

EFFICIENCY_GRADE_THRESHOLDS = {
    "efficient": 72.0,
    "moderate": 52.0,
}


def expected_user_tokens(task_tier: str, user_turn_count: int) -> int:
    """Token budget for user-authored content given task complexity."""
    base = TIER_BASE_USER_TOKENS.get(task_tier, TIER_BASE_USER_TOKENS["moderate"])
    per_turn = TIER_PER_USER_TURN_TOKENS.get(
        task_tier, TIER_PER_USER_TURN_TOKENS["moderate"]
    )
    extra_turns = max(0, user_turn_count - 1)
    return base + per_turn * extra_turns


def compute_prompt_quality(
    user_turns: list[Turn],
    turns: list[Turn],
    task_tier: str,
    turn_suggestions: list[dict] | None = None,
) -> dict:
    """
    Dedicated prompt-quality score (not the 12-dimension AI usage average).

    Pillars: clarity 35%, context 25%, task-appropriate depth 25%, iteration 15%.
    """
    if not user_turns:
        return {
            "score": 0.0,
            "pillars": {
                "clarity": 0.0,
                "context": 0.0,
                "depth": 0.0,
                "iteration": 0.0,
            },
            "issue_density_penalty": 0.0,
        }

    clarity, _ = _score_prompting_skills(user_turns)
    context, _ = _score_context_management(user_turns)
    decompose, _ = _score_problem_decomposition(user_turns)
    iteration, _ = _score_iteration(user_turns)

    avg_words = sum(len(t.content.split()) for t in user_turns) / len(user_turns)
    if task_tier == "simple":
        conciseness = max(0.0, min(100.0, 100.0 - max(0.0, avg_words - 20) * 1.8))
        depth = round(0.55 * decompose + 0.45 * conciseness, 1)
    elif task_tier == "complex":
        depth = decompose
    else:
        depth = round(0.7 * decompose + 0.3 * max(0.0, 100.0 - max(0.0, avg_words - 35)), 1)

    raw = (
        0.35 * clarity
        + 0.25 * context
        + 0.25 * depth
        + 0.15 * iteration
    )

    suggestions = turn_suggestions or []
    issues_per_turn = len(suggestions) / max(len(user_turns), 1)
    issue_penalty = min(15.0, issues_per_turn * 8.0)
    score = max(0.0, min(100.0, raw - issue_penalty))

    return {
        "score": round(score, 1),
        "pillars": {
            "clarity": round(clarity, 1),
            "context": round(context, 1),
            "depth": round(depth, 1),
            "iteration": round(iteration, 1),
        },
        "issue_density_penalty": round(issue_penalty, 1),
    }


def token_efficiency_score(
    user_tokens: int,
    expected_user_tokens: int,
    recoverable_tokens: int,
) -> float:
    """Score how lean user prompts are relative to the complexity budget."""
    ratio = user_tokens / max(expected_user_tokens, 1)
    if ratio <= 1.2:
        score = 95.0 - (ratio - 1.0) * 25.0
    elif ratio <= 2.0:
        score = 89.0 - (ratio - 1.2) * 23.75
    elif ratio <= 3.5:
        score = 70.0 - (ratio - 2.0) * 13.33
    else:
        score = max(0.0, 50.0 - (ratio - 3.5) * 10.0)

    if user_tokens > 0 and recoverable_tokens / user_tokens < 0.1:
        score = min(100.0, score + 5.0)

    return round(max(0.0, min(100.0, score)), 1)


def model_efficiency_score(
    *,
    user_reported_model: str | None,
    detected_model: str | None,
    tier_recommended_model: str | None,
    recommendations: list[dict],
) -> float:
    """Score whether the model used/reported matches the task-tier recommendation."""
    actual = (user_reported_model or "").strip() or detected_model
    if not tier_recommended_model:
        return 70.0
    if not actual:
        return 85.0
    if actual == tier_recommended_model:
        return 100.0

    by_id = {row["model_id"]: row for row in recommendations}
    actual_row = by_id.get(actual)
    tier_row = by_id.get(tier_recommended_model)
    if not actual_row or not tier_row:
        return 70.0

    tier_cost = float(tier_row.get("est_input_cost_usd", 0))
    actual_cost = float(actual_row.get("est_input_cost_usd", 0))
    if tier_cost <= 0:
        return 70.0

    cost_ratio = actual_cost / tier_cost
    if cost_ratio <= 1.15:
        return 90.0
    if cost_ratio <= 1.5:
        return 75.0
    if cost_ratio <= 2.5:
        return 55.0
    return 35.0


def compute_efficiency_grade(
    *,
    prompt_quality_score: float,
    user_tokens: int,
    task_tier: str,
    user_turn_count: int,
    token_savings: dict,
    user_reported_model: str | None,
    detected_model: str | None,
    tier_recommended_model: str | None,
    recommendations: list[dict],
) -> dict:
    """Weighted efficiency composite (Phase 1)."""
    expected = expected_user_tokens(task_tier, user_turn_count)
    recoverable = int(token_savings.get("savings_tokens", 0) or 0)
    excess = max(0, user_tokens - expected)

    token_score = token_efficiency_score(user_tokens, expected, recoverable)
    model_score = model_efficiency_score(
        user_reported_model=user_reported_model,
        detected_model=detected_model,
        tier_recommended_model=tier_recommended_model,
        recommendations=recommendations,
    )

    w = EFFICIENCY_WEIGHTS
    efficiency = (
        w["prompt"] * prompt_quality_score
        + w["token"] * token_score
        + w["model"] * model_score
    )
    efficiency = round(max(0.0, min(100.0, efficiency)), 1)

    if efficiency >= EFFICIENCY_GRADE_THRESHOLDS["efficient"]:
        grade = "Efficient"
    elif efficiency >= EFFICIENCY_GRADE_THRESHOLDS["moderate"]:
        grade = "Moderate"
    else:
        grade = "Inefficient"

    factors: list[str] = []
    if prompt_quality_score < 65:
        factors.append(f"prompt quality {prompt_quality_score:.0f}%")
    if token_score < 65:
        factors.append(
            f"user tokens ({user_tokens:,}) above tier budget ({expected:,})"
        )
    if model_score < 75 and tier_recommended_model:
        used = user_reported_model or detected_model or "unknown"
        factors.append(
            f"model fit: {used} vs recommended {tier_recommended_model}"
        )
    if not factors:
        factors.append("balanced prompt, token, and model use for this tier")

    verdict_parts = [
        f"{prompt_quality_score:.0f}% prompt quality on {user_tokens:,} user tokens"
    ]
    if grade == "Inefficient":
        verdict_parts.append("inefficient session overall")
    elif grade == "Moderate":
        verdict_parts.append("moderately efficient session")
    else:
        verdict_parts.append("efficient session overall")

    if recoverable > 0:
        verdict_parts.append(
            f"~{recoverable} user tokens recoverable with suggested edits"
        )

    return {
        "efficiency_score": efficiency,
        "grade": grade,
        "prompting_quality_score": round(prompt_quality_score, 1),
        "ai_usage_score": None,
        "expected_tokens_for_complexity": expected,
        "expected_user_tokens": expected,
        "excess_tokens_vs_expected": excess,
        "user_tokens": user_tokens,
        "breakdown": {
            "prompt_quality": round(prompt_quality_score, 1),
            "token_efficiency": token_score,
            "model_efficiency": model_score,
        },
        "efficiency_factors": factors,
        "verdict": " — ".join(verdict_parts) + ".",
        "methodology": (
            "Efficiency combines dedicated prompt quality (45%), user-token discipline "
            "vs task-tier budget (35%), and model-tier fit (20%). AI usage breadth "
            "score is reported separately."
        ),
    }

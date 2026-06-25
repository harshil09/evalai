"""Tests for Phase 1–2 session scoring and task-tier reference."""

from worker.cost_analysis import (
    REFERENCE_STRATEGY_LEGACY,
    REFERENCE_STRATEGY_TASK_TIER,
    pick_reference_model,
)
from worker.parser import Turn, parse_transcript
from worker.prompting_coach import build_prompting_recommendations, classify_task_complexity
from worker.session_profile import (
    compute_efficiency_grade,
    compute_prompt_quality,
    expected_user_tokens,
    token_efficiency_score,
)


def _recommendations():
    return [
        {
            "model_id": "gemini-2.0-flash",
            "provider": "Google",
            "fits": True,
            "est_input_cost_usd": 0.001,
            "total_tokens": 1000,
        },
        {
            "model_id": "gpt-4o-mini",
            "provider": "OpenAI",
            "fits": True,
            "est_input_cost_usd": 0.002,
            "total_tokens": 1000,
        },
        {
            "model_id": "gpt-4o",
            "provider": "OpenAI",
            "fits": True,
            "est_input_cost_usd": 0.02,
            "total_tokens": 1000,
        },
    ]


def test_task_tier_reference_before_default():
    recs = _recommendations()
    model_id, source = pick_reference_model(
        None,
        recs,
        reference_strategy=REFERENCE_STRATEGY_TASK_TIER,
        task_tier="simple",
        tier_recommended_model="gemini-2.0-flash",
    )
    assert model_id == "gemini-2.0-flash"
    assert source == "task tier (simple)"


def test_legacy_reference_uses_default():
    recs = _recommendations()
    model_id, source = pick_reference_model(
        None,
        recs,
        reference_strategy=REFERENCE_STRATEGY_LEGACY,
        task_tier="simple",
        tier_recommended_model="gemini-2.0-flash",
        default_reference_model="gpt-4o",
    )
    assert model_id == "gpt-4o"
    assert "default" in source


def test_user_reported_beats_task_tier():
    recs = _recommendations()
    model_id, source = pick_reference_model(
        None,
        recs,
        user_reported_model="gpt-4o",
        reference_strategy=REFERENCE_STRATEGY_TASK_TIER,
        task_tier="simple",
        tier_recommended_model="gemini-2.0-flash",
    )
    assert model_id == "gpt-4o"
    assert source == "reported at upload"


def test_expected_user_tokens_scales_with_turns():
    simple_one = expected_user_tokens("simple", 1)
    simple_five = expected_user_tokens("simple", 5)
    assert simple_five > simple_one
    assert expected_user_tokens("complex", 3) > expected_user_tokens("simple", 3)


def test_efficiency_uses_user_tokens_not_agent_inflation():
    expected = expected_user_tokens("moderate", 4)
    result = compute_efficiency_grade(
        prompt_quality_score=72.0,
        user_tokens=expected + 200,
        task_tier="moderate",
        user_turn_count=4,
        token_savings={"savings_tokens": 50},
        user_reported_model=None,
        detected_model=None,
        tier_recommended_model="gpt-4o-mini",
        recommendations=_recommendations(),
    )
    assert result["efficiency_score"] >= 52
    assert result["excess_tokens_vs_expected"] == 200


def test_prompt_quality_not_equal_to_twelve_dim_average():
    turns = [
        Turn(0, "user", "Goal: fix login bug. Context: FastAPI app. Output: numbered steps."),
        Turn(1, "agent", "Here are steps..."),
    ]
    user_turns = [t for t in turns if t.role == "user"]
    pq = compute_prompt_quality(user_turns, turns, "moderate", turn_suggestions=[])
    assert 0 <= pq["score"] <= 100
    assert "clarity" in pq["pillars"]


def test_token_efficiency_bonus_for_low_recoverable():
    expected = 2000
    base = token_efficiency_score(2100, expected, recoverable_tokens=50)
    assert base >= 85.0


SAMPLE = """User: git status
Agent: On branch main.

User: Summarize the API design for our billing service. Include endpoints and auth.
Agent: Draft...

User: git diff
Agent: Shows changes.
"""


def test_build_prompting_recommendations_includes_session_profile():
    turns, _ = parse_transcript(SAMPLE)
    tokens = [40] * len(turns)
    user_tokens = sum(c for t, c in zip(turns, tokens) if t.role == "user")
    task_tier, task_score, task_rationale = classify_task_complexity(
        turns, [t for t in turns if t.role == "user"], sum(tokens), max(tokens)
    )
    result = build_prompting_recommendations(
        turns,
        tokens_by_turn=tokens,
        total_tokens=sum(tokens),
        user_tokens=user_tokens,
        max_turn_tokens=max(tokens),
        encoding_name="cl100k_base",
        user_evaluation={"overall_score": 65.0, "dimensions": []},
        cost_analysis={
            "reference_model": "gemini-2.0-flash",
            "reference_source": "task tier (simple)",
            "tier_recommended_model": "gemini-2.0-flash",
            "detected_model": None,
            "user_reported_model": None,
        },
        recommendations=_recommendations(),
        task_profile={
            "complexity_tier": task_tier,
            "complexity_score": task_score,
            "complexity_rationale": task_rationale,
        },
        use_llm=False,
    )
    profile = result.get("session_profile") or {}
    assert profile.get("prompt_quality", {}).get("score") is not None
    assert result["prompt_efficiency"]["ai_usage_score"] == 65.0
    assert "breakdown" in result["prompt_efficiency"]

"""Tests for dynamic model comparison notes (Phase 2)."""

from worker.analytics import _model_fit_comparison_note


def test_reference_row_task_tier_label():
    note = _model_fit_comparison_note(
        "gpt-4o-mini",
        {"model_id": "gpt-4o-mini", "fits": True, "est_input_cost_usd": 0.002, "total_tokens": 1000},
        0.002,
        reference_source="task tier (moderate)",
        task_tier="moderate",
    )
    assert "moderate" in note.lower()
    assert "baseline" in note.lower()


def test_cheaper_model_note_uses_task_tier_not_generic_premium():
    note = _model_fit_comparison_note(
        "gpt-4o-mini",
        {
            "model_id": "gemini-2.0-flash",
            "fits": True,
            "est_input_cost_usd": 0.0002,
            "total_tokens": 1000,
            "input_price_per_1m": 0.1,
        },
        0.002,
        reference_source="task tier (simple)",
        task_tier="simple",
    )
    assert "96" in note or "lower" in note.lower()
    assert "simple" in note.lower()
    assert "complex reasoning and multi-step" not in note

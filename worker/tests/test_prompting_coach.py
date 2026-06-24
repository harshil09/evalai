"""Smoke tests for hybrid prompting coach and redundancy detection."""

from worker.parser import Turn, parse_transcript
from worker.prompting_coach import build_prompting_recommendations
from worker.similarity import redundancy_matrix


SAMPLE = """User: git status
Agent: On branch main, nothing to commit.

User: Summarize the API design for our billing service. Include endpoints and auth.
Agent: Here is a draft...

User: Can you also list the database tables we discussed?
Agent: Sure — users, subscriptions, invoices.

User: Summarize the API design for our billing service. Include endpoints and auth.
Agent: (repeats)

User: git diff
Agent: Shows unstaged changes.

User: Summarize billing API endpoints and authentication again please.
Agent: Repeated summary.

User: npm test
Agent: Tests passed.
"""


def _minimal_eval():
    return {
        "overall_score": 62.0,
        "dimensions": [
            {"id": "redundancy_detection", "label": "Redundancy detection", "score": 45.0},
            {"id": "context_management", "label": "Context management", "score": 58.0},
        ],
    }


def _minimal_cost():
    return {
        "reference_model": "gpt-4o",
        "reference_source": "default",
        "reference_cost_usd": 0.01,
        "reference_cost_label": "$0.01",
        "recommended_model": "gpt-4o-mini",
        "recommended_cost_label": "$0.001",
    }


def _minimal_recommendations():
    return [
        {
            "model_id": "gpt-4o",
            "provider": "OpenAI",
            "fits": True,
            "est_input_cost_usd": 0.01,
            "headroom_tokens": 100000,
        },
        {
            "model_id": "gpt-4o-mini",
            "provider": "OpenAI",
            "fits": True,
            "est_input_cost_usd": 0.001,
            "headroom_tokens": 100000,
        },
    ]


def test_short_dev_commands_not_all_vague():
    turns, _ = parse_transcript(SAMPLE)
    user_turns = [t for t in turns if t.role == "user"]
    tokens = [len(t.content.split()) * 4 for t in turns]
    result = build_prompting_recommendations(
        turns,
        tokens_by_turn=tokens,
        total_tokens=sum(tokens),
        max_turn_tokens=max(tokens),
        encoding_name="cl100k_base",
        user_evaluation=_minimal_eval(),
        cost_analysis=_minimal_cost(),
        recommendations=_minimal_recommendations(),
        use_llm=False,
    )
    issues = [n.get("issue") for n in result.get("coaching_notes", [])]
    vague_count = sum(1 for i in issues if "vague" in str(i))
    assert vague_count < len(user_turns), "Short dev commands should not all be vague"


def test_non_adjacent_redundancy_edges():
    turns, _ = parse_transcript(SAMPLE)
    user_turns = [t for t in turns if t.role == "user"]
    edges = redundancy_matrix(user_turns, use_embeddings=False, threshold=0.55)
    distant = [
        e
        for e in edges
        if abs(e["turn_index_a"] - e["turn_index_b"]) > 2
    ]
    assert distant, "Expected non-adjacent redundant turn pairs"


def test_llm_off_returns_hybrid_methodology():
    turns, _ = parse_transcript(SAMPLE)
    tokens = [50] * len(turns)
    result = build_prompting_recommendations(
        turns,
        tokens_by_turn=tokens,
        total_tokens=sum(tokens),
        max_turn_tokens=50,
        encoding_name="cl100k_base",
        user_evaluation=_minimal_eval(),
        cost_analysis=_minimal_cost(),
        recommendations=_minimal_recommendations(),
        use_llm=False,
    )
    assert "rules" in result.get("methodology", "").lower()
    assert "waste_buckets" not in result


if __name__ == "__main__":
    test_short_dev_commands_not_all_vague()
    test_non_adjacent_redundancy_edges()
    test_llm_off_returns_hybrid_methodology()
    print("All prompting coach smoke tests passed.")

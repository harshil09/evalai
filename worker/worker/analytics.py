import tiktoken

from worker.config import get_settings
from worker.cost_analysis import build_cost_analysis
from worker.model_catalog import load_model_catalog
from worker.parser import Turn
from worker.user_evaluation import evaluate_user_ai_usage


def _get_encoding(name: str) -> tiktoken.Encoding:
    try:
        return tiktoken.get_encoding(name)
    except KeyError:
        return tiktoken.get_encoding("cl100k_base")


def count_tokens(text: str, encoding_name: str = "cl100k_base") -> int:
    encoding = _get_encoding(encoding_name)
    return len(encoding.encode(text))


def count_turn_tokens(turns: list[Turn], encoding_name: str = "cl100k_base") -> list[int]:
    return [count_tokens(turn.content, encoding_name) for turn in turns]


def analyze_transcript(
    turns: list[Turn],
    parse_warnings: list[str],
    *,
    catalog: list[dict] | None = None,
    reserved_output_tokens: int | None = None,
    default_reference_model: str | None = None,
    user_reported_model: str | None = None,
) -> dict:
    settings = get_settings()
    reserved = (
        reserved_output_tokens
        if reserved_output_tokens is not None
        else settings["reserved_output_tokens"]
    )
    reference_model = default_reference_model or "gpt-4o"
    encoding_name = "cl100k_base"

    tokens_by_turn = count_turn_tokens(turns, encoding_name)
    user_tokens = sum(
        count for turn, count in zip(turns, tokens_by_turn) if turn.role == "user"
    )
    agent_tokens = sum(
        count for turn, count in zip(turns, tokens_by_turn) if turn.role == "agent"
    )
    total_tokens = user_tokens + agent_tokens
    turn_count = len(turns)
    max_turn_tokens = max(tokens_by_turn) if tokens_by_turn else 0
    avg_tokens = round(total_tokens / turn_count, 1) if turn_count else 0

    if catalog is None:
        catalog, _ = load_model_catalog()
    recommendations: list[dict] = []
    for model in catalog:
        model_encoding = model.get("encoding", encoding_name)
        model_total = sum(count_turn_tokens(turns, model_encoding))
        usable_window = model["context_window"] - reserved
        fits = model_total <= usable_window
        headroom = usable_window - model_total
        est_cost = round(
            (model_total / 1_000_000) * model["input_price_per_1m"], 6
        )
        recommendations.append(
            {
                "model_id": model["model_id"],
                "provider": model["provider"],
                "context_window": model["context_window"],
                "total_tokens": model_total,
                "fits": fits,
                "headroom_tokens": headroom,
                "est_input_cost_usd": est_cost,
            }
        )

    recommendations.sort(key=lambda item: (not item["fits"], item["est_input_cost_usd"]))
    best_fit = next((r for r in recommendations if r["fits"]), None)
    cost_analysis = build_cost_analysis(
        turns,
        recommendations,
        user_reported_model=user_reported_model,
        default_reference_model=reference_model,
    )
    user_evaluation = evaluate_user_ai_usage(turns, recommendations, cost_analysis)

    return {
        "encoding_used": encoding_name,
        "total_tokens": total_tokens,
        "user_tokens": user_tokens,
        "agent_tokens": agent_tokens,
        "turn_count": turn_count,
        "avg_tokens_per_turn": avg_tokens,
        "max_turn_tokens": max_turn_tokens,
        "tokens_by_turn": [
            {
                "turn_index": turn.turn_index,
                "role": turn.role,
                "tokens": token_count,
            }
            for turn, token_count in zip(turns, tokens_by_turn)
        ],
        "model_recommendations": recommendations,
        "best_fit_model": best_fit["model_id"] if best_fit else None,
        "cost_analysis": cost_analysis,
        "parse_warnings": parse_warnings,
        "user_evaluation": user_evaluation,
        "reserved_output_tokens": reserved,
        "default_reference_model": reference_model,
        "user_reported_model": (user_reported_model or "").strip() or None,
    }

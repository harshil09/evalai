import re

from worker.parser import Turn

# Longer patterns first so gpt-4o-mini matches before gpt-4o
MODEL_DETECTION_RULES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bgpt-4o-mini\b", re.I), "gpt-4o-mini"),
    (re.compile(r"\bgpt-4\.1-nano\b", re.I), "gpt-4.1-nano"),
    (re.compile(r"\bgpt-4\.1-mini\b", re.I), "gpt-4.1-mini"),
    (re.compile(r"\bgpt-4\.1\b", re.I), "gpt-4.1"),
    (re.compile(r"\bgpt-4o\b", re.I), "gpt-4o"),
    (re.compile(r"\bo3-mini\b", re.I), "o3-mini"),
    (re.compile(r"\bo1\b", re.I), "o1"),
    (re.compile(r"\bclaude\s*3\.5\s*haiku\b", re.I), "claude-3-5-haiku"),
    (re.compile(r"\bclaude\s*opus\s*4\b", re.I), "claude-opus-4"),
    (re.compile(r"\bclaude\s*sonnet\s*4\b", re.I), "claude-sonnet-4"),
    (re.compile(r"\bclaude\s*sonnet\b", re.I), "claude-sonnet-4"),
    (re.compile(r"\bgemini\s*2\.5\s*pro\b", re.I), "gemini-2.5-pro"),
    (re.compile(r"\bgemini\s*2\.5\s*flash\b", re.I), "gemini-2.5-flash"),
    (re.compile(r"\bgemini\s*2\.0\s*flash\b", re.I), "gemini-2.0-flash"),
    (re.compile(r"\bgemini\s*1\.5\s*pro\b", re.I), "gemini-1.5-pro"),
    (re.compile(r"\bmistral\s*large\b", re.I), "mistral-large"),
    (re.compile(r"\bmistral\s*small\b", re.I), "mistral-small"),
    (re.compile(r"\bdeepseek\s*reasoner\b", re.I), "deepseek-reasoner"),
    (re.compile(r"\bdeepseek\b", re.I), "deepseek-chat"),
    (re.compile(r"\bllama\s*4\s*scout\b", re.I), "llama-4-scout"),
    (re.compile(r"\bllama\s*3\.3\b", re.I), "llama-3.3-70b"),
    (re.compile(r"\bgrok\s*3\s*mini\b", re.I), "grok-3-mini"),
    (re.compile(r"\bgrok\s*2\b", re.I), "grok-2"),
    (re.compile(r"\bcommand\s*r\s*plus\b", re.I), "command-r-plus"),
    (re.compile(r"\bcommand\s*r\b", re.I), "command-r"),
    (re.compile(r"\bchatgpt\b", re.I), "gpt-4o"),
    (re.compile(r"\bcopilot\b", re.I), "gpt-4o"),
]

DEFAULT_REFERENCE_MODEL = "gpt-4o"


def format_usd(amount: float) -> str:
    if amount <= 0:
        return "$0.000000"
    if amount < 0.0001:
        return f"${amount:.8f}"
    if amount < 0.01:
        return f"${amount:.6f}"
    if amount < 1:
        return f"${amount:.4f}"
    return f"${amount:.2f}"


def detect_model_from_transcript(turns: list[Turn], catalog_ids: set[str]) -> str | None:
    """Pick the model explicitly mentioned most often in the transcript."""
    counts: dict[str, int] = {}
    for turn in turns:
        for pattern, model_id in MODEL_DETECTION_RULES:
            if model_id not in catalog_ids:
                continue
            if pattern.search(turn.content):
                counts[model_id] = counts.get(model_id, 0) + 1

    if not counts:
        return None
    return max(counts, key=counts.get)


def pick_reference_model(
    detected: str | None,
    recommendations: list[dict],
    *,
    user_reported_model: str | None = None,
    default_reference_model: str = DEFAULT_REFERENCE_MODEL,
) -> tuple[str, str]:
    """
    Reference model for savings comparison.
    Priority: user-reported at upload → mentioned in transcript → configured default → premium fitting.
    """
    by_id = {row["model_id"]: row for row in recommendations}
    fitting = [row for row in recommendations if row.get("fits")]

    reported = (user_reported_model or "").strip()
    if reported and reported in by_id:
        return reported, "reported at upload"

    if detected and detected in by_id:
        return detected, "mentioned in transcript"

    if default_reference_model in by_id and by_id[default_reference_model].get("fits"):
        return default_reference_model, f"default ({default_reference_model})"

    if fitting:
        premium = max(fitting, key=lambda row: row["est_input_cost_usd"])
        return premium["model_id"], "estimated premium tier for this transcript"

    return recommendations[0]["model_id"], "fallback"


def build_cost_analysis(
    turns: list[Turn],
    recommendations: list[dict],
    *,
    user_reported_model: str | None = None,
    default_reference_model: str = DEFAULT_REFERENCE_MODEL,
) -> dict:
    fitting = [row for row in recommendations if row.get("fits")]
    if not fitting:
        return {
            "session_tokens": recommendations[0]["total_tokens"] if recommendations else 0,
            "reference_model": None,
            "reference_source": "no model fits this transcript size",
            "recommended_model": None,
            "reference_cost_usd": 0.0,
            "recommended_cost_usd": 0.0,
            "savings_usd": 0.0,
            "savings_percent": 0.0,
            "model_comparisons": [],
        }

    catalog_ids = {row["model_id"] for row in recommendations}
    detected = detect_model_from_transcript(turns, catalog_ids)
    reference_id, reference_source = pick_reference_model(
        detected,
        recommendations,
        user_reported_model=user_reported_model,
        default_reference_model=default_reference_model,
    )

    reference_row = next(row for row in recommendations if row["model_id"] == reference_id)
    recommended_row = fitting[0]
    reference_cost = float(reference_row["est_input_cost_usd"])
    recommended_cost = float(recommended_row["est_input_cost_usd"])

    if reference_cost > 0:
        savings_usd = max(0.0, reference_cost - recommended_cost)
        savings_percent = round((savings_usd / reference_cost) * 100, 1)
    else:
        savings_usd = 0.0
        savings_percent = 0.0

    session_tokens = reference_row["total_tokens"]
    comparisons: list[dict] = []

    for row in sorted(recommendations, key=lambda item: item["est_input_cost_usd"]):
        cost = float(row["est_input_cost_usd"])
        vs_ref_usd = reference_cost - cost
        vs_ref_pct = round((vs_ref_usd / reference_cost) * 100, 1) if reference_cost > 0 else 0.0
        comparisons.append(
            {
                "model_id": row["model_id"],
                "provider": row["provider"],
                "fits": row["fits"],
                "total_tokens": row["total_tokens"],
                "est_input_cost_usd": cost,
                "est_input_cost_label": format_usd(cost),
                "savings_vs_reference_usd": round(vs_ref_usd, 8),
                "savings_vs_reference_label": format_usd(max(0.0, vs_ref_usd)),
                "savings_vs_reference_percent": vs_ref_pct,
                "is_reference": row["model_id"] == reference_id,
                "is_recommended": row["model_id"] == recommended_row["model_id"],
            }
        )

    return {
        "session_tokens": session_tokens,
        "user_reported_model": (user_reported_model or "").strip() or None,
        "detected_model": detected,
        "reference_model": reference_id,
        "reference_source": reference_source,
        "recommended_model": recommended_row["model_id"],
        "reference_cost_usd": round(reference_cost, 8),
        "reference_cost_label": format_usd(reference_cost),
        "recommended_cost_usd": round(recommended_cost, 8),
        "recommended_cost_label": format_usd(recommended_cost),
        "savings_usd": round(savings_usd, 8),
        "savings_label": format_usd(savings_usd),
        "savings_percent": savings_percent,
        "model_comparisons": comparisons,
        "note": (
            "Costs use this transcript's actual token count × catalog input price per 1M tokens. "
            "Savings compare each model to the reference model for this session only."
        ),
    }

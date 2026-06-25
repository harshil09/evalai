"""Rule-based prompting coach: turn suggestions, token savings, task-aware model advice."""

from __future__ import annotations

import re
from statistics import median

import tiktoken

from worker.cost_analysis import format_usd
from worker.session_profile import compute_efficiency_grade, compute_prompt_quality
from worker.parser import Turn
from worker.user_evaluation import (
    DECOMPOSE_PATTERNS,
    ONE_SHOT_EXPECTATION,
    PRIVACY_RISK_PATTERNS,
    PROMPTING_PATTERNS,
    TECH_DATA_AI_PATTERNS,
    TECH_SOFTWARE_PATTERNS,
    VAGUE_PATTERNS,
    VERIFY_DEBUG_PATTERNS,
    _jaccard,
    _tokenize,
)

WORD_RE = re.compile(r"[a-z0-9']+")
FILLER_RE = re.compile(
    r"\b(please|just|really|very|actually|basically|literally|kind of|sort of)\b",
    re.I,
)
FORMAT_PATTERNS = re.compile(
    r"\b(json|markdown|table|bullet|list|csv|yaml|step[s]?|format|template|outline)\b",
    re.I,
)
CONCISENESS_PATTERNS = re.compile(
    r"\b(brief|concise|short|max\s+\d+\s+words?|under\s+\d+\s+words?)\b",
    re.I,
)

EXTRACTION_PATTERNS = re.compile(
    r"\b(extract|parse|pull out|scrape|fields? from|get the|list all)\b",
    re.I,
)
TRANSFORMATION_PATTERNS = re.compile(
    r"\b(summariz|rewrite|rephrase|translate|convert|format|clean up|paraphrase)\b",
    re.I,
)
DEBUGGING_PATTERNS = re.compile(
    r"\b(error|bug|debug|fix|stack trace|exception|500|404|fails?|broken|crash)\b",
    re.I,
)
REASONING_PATTERNS = re.compile(
    r"\b(architect|design|trade.?off|compare|evaluate|pros and cons|strategy|why should)\b",
    re.I,
)
CREATIVE_PATTERNS = re.compile(
    r"\b(write|draft|brainstorm|story|poem|blog|marketing copy|tagline)\b",
    re.I,
)
AGENTIC_PATTERNS = re.compile(
    r"\b(agent|workflow|multi.?step|tool use|autonomous|handoff|orchestrat)\b",
    re.I,
)

TASK_TYPE_LABELS = {
    "extraction": "Extraction",
    "transformation": "Transformation",
    "debugging": "Debugging",
    "reasoning": "Reasoning",
    "creative": "Creative",
    "agentic": "Agentic",
    "general": "General",
}

WASTE_BUCKET_ISSUES: dict[str, set[str]] = {
    "structural": {
        "repeated_context",
        "context_dump",
        "verbose_prompt",
        "missing_decomposition",
    },
    "instruction": {
        "vague_request",
        "missing_format",
        "missing_conciseness",
        "privacy_risk",
    },
    "conversation": {"one_shot_expectation"},
}

WASTE_BUCKET_FIXES: dict[str, str] = {
    "structural": "Summarize context once, decompose large asks, and remove filler repetition.",
    "instruction": "State goal, constraints, and output format in the first message.",
    "conversation": "Iterate in steps instead of expecting a perfect answer immediately.",
    "model": "Match model tier to task type — avoid premium models for simple transforms.",
}

# Preferred models per task-complexity tier (first match wins among fitting models).
TIER_MODEL_PREFERENCES: dict[str, list[str]] = {
    "simple": [
        "gemini-2.0-flash",
        "gpt-4o-mini",
        "deepseek-chat",
        "mistral-small",
        "claude-3-5-haiku",
        "gpt-4.1-mini",
    ],
    "moderate": [
        "gpt-4o-mini",
        "gpt-4.1-mini",
        "gemini-2.0-flash",
        "mistral-small",
        "claude-3-5-haiku",
        "gemini-1.5-pro",
    ],
    "complex": [
        "claude-sonnet-4",
        "gpt-4o",
        "gpt-4.1",
        "gemini-1.5-pro",
    ],
}

DIMENSION_PLAYBOOK: dict[str, str] = {
    "prompting_skills": (
        "Lead with role, goal, and expected output format in the first sentence."
    ),
    "ai_limitations": (
        "Ask the AI to cite assumptions and flag uncertain claims for human review."
    ),
    "problem_decomposition": (
        "Split large requests into numbered steps and tackle one subtask per turn."
    ),
    "tool_choice": (
        "Match model tier to task complexity — simple formatting tasks rarely need premium models."
    ),
    "iteration": (
        "Refine outputs across turns instead of expecting a perfect first response."
    ),
    "context_management": (
        "Attach IDs, links, and constraints once; reference earlier turns instead of re-pasting."
    ),
    "technical_knowledge": (
        "Name stack, versions, and error messages so the AI can reason precisely."
    ),
    "verification_debugging": (
        "Request reproducible steps, test cases, or validation checks with each fix."
    ),
    "automation": (
        "Describe the workflow end-to-end (trigger → action → output) when automating."
    ),
    "agent_understanding": (
        "Assign explicit subtasks and ask for intermediate checkpoints in agent workflows."
    ),
    "privacy": (
        "Redact secrets and use placeholders (e.g. ending in ****) instead of raw credentials."
    ),
    "output_quality": (
        "Define acceptance criteria: accuracy target, format, and how you will review results."
    ),
}

ISSUE_PRIORITY = {
    "privacy_risk": 0,
    "vague_request": 1,
    "missing_format": 2,
    "repeated_context": 3,
    "context_dump": 4,
    "one_shot_expectation": 5,
    "missing_decomposition": 6,
    "verbose_prompt": 7,
    "missing_conciseness": 8,
}


def _count_tokens(text: str, encoding_name: str = "cl100k_base") -> int:
    try:
        encoding = tiktoken.get_encoding(encoding_name)
    except KeyError:
        encoding = tiktoken.get_encoding("cl100k_base")
    return len(encoding.encode(text))


def _user_turns(turns: list[Turn]) -> list[Turn]:
    return [t for t in turns if t.role == "user"]


def _excerpt(text: str, limit: int = 120) -> str:
    cleaned = " ".join(text.split())
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[: limit - 3] + "..."


def _bounded_suggestion(text: str, max_chars: int = 480) -> str:
    """Keep coach suggestions readable when the original turn is very long."""
    cleaned = text.strip()
    if len(cleaned) <= max_chars:
        return cleaned
    return (
        f"{_excerpt(cleaned, max_chars - 90)}\n\n"
        "[Message truncated — summarize only the key facts needed for this request.]"
    )


def _compress_filler(text: str) -> str:
    compressed = FILLER_RE.sub(" ", text)
    return re.sub(r"\s+", " ", compressed).strip()


def classify_task_complexity(
    turns: list[Turn],
    user_turns: list[Turn],
    total_tokens: int,
    max_turn_tokens: int,
) -> tuple[str, float, str]:
    """Return (tier, score 0-100, rationale)."""
    if not user_turns:
        return "simple", 0.0, "No user messages to classify."

    sw = sum(1 for t in user_turns if TECH_SOFTWARE_PATTERNS.search(t.content)) / len(user_turns)
    data = sum(1 for t in user_turns if TECH_DATA_AI_PATTERNS.search(t.content)) / len(user_turns)
    debug = sum(1 for t in user_turns if VERIFY_DEBUG_PATTERNS.search(t.content)) / len(user_turns)
    decompose = sum(1 for t in user_turns if DECOMPOSE_PATTERNS.search(t.content)) / len(user_turns)

    score = 0.0
    score += sw * 28
    score += data * 22
    score += debug * 25
    score += decompose * 15
    if len(user_turns) >= 6:
        score += 12
    if total_tokens >= 6000:
        score += 18
    elif total_tokens >= 2500:
        score += 8
    if max_turn_tokens >= 900:
        score += 15
    elif max_turn_tokens >= 450:
        score += 7

    score = min(100.0, score)

    if score >= 60:
        tier = "complex"
        rationale = (
            "Multi-step technical work, debugging, or long context suggests a capable "
            "reasoning model."
        )
    elif score >= 30:
        tier = "moderate"
        rationale = (
            "Mixed task with some technical depth; a mid-tier model balances cost and quality."
        )
    else:
        tier = "simple"
        rationale = (
            "Short or straightforward exchanges; a fast economical model is usually sufficient."
        )

    return tier, round(score, 1), rationale


_classify_task_complexity = classify_task_complexity


def pick_tier_model(
    tier: str,
    recommendations: list[dict],
) -> dict | None:
    fitting = {row["model_id"]: row for row in recommendations if row.get("fits")}
    if not fitting:
        return None

    for model_id in TIER_MODEL_PREFERENCES.get(tier, []):
        if model_id in fitting:
            return fitting[model_id]

    cheapest = min(fitting.values(), key=lambda row: row["est_input_cost_usd"])
    return cheapest


_pick_tier_model = pick_tier_model


def _build_model_advice(
    task_tier: str,
    task_score: float,
    task_rationale: str,
    recommendations: list[dict],
    cost_analysis: dict,
) -> dict:
    tier_row = pick_tier_model(task_tier, recommendations)
    reference_id = cost_analysis.get("reference_model")
    reference_row = next(
        (row for row in recommendations if row["model_id"] == reference_id),
        None,
    )

    cost_fit_id = cost_analysis.get("recommended_model")

    tier_labels = {
        "simple": "Simple",
        "moderate": "Moderate",
        "complex": "Complex",
    }

    advice: dict = {
        "task_tier": task_tier,
        "task_tier_label": tier_labels.get(task_tier, task_tier.title()),
        "task_complexity_score": task_score,
        "rationale": task_rationale,
        "tier_recommended_model": None,
        "tier_recommended_cost_usd": None,
        "tier_recommended_cost_label": None,
        "reference_model": reference_id,
        "reference_source": cost_analysis.get("reference_source"),
        "reference_cost_label": cost_analysis.get("reference_cost_label"),
        "cost_fit_recommended_model": cost_fit_id,
        "cost_fit_cost_label": cost_analysis.get("recommended_cost_label"),
        "note": (
            "Task-tier advice picks a model suited to complexity; cost-fit advice picks "
            "the cheapest model that still fits the context window."
        ),
    }

    if tier_row:
        cost = float(tier_row["est_input_cost_usd"])
        advice["tier_recommended_model"] = tier_row["model_id"]
        advice["tier_recommended_cost_usd"] = round(cost, 8)
        advice["tier_recommended_cost_label"] = format_usd(cost)

    if reference_row and tier_row and reference_row["model_id"] != tier_row["model_id"]:
        ref_cost = float(reference_row["est_input_cost_usd"])
        tier_cost = float(tier_row["est_input_cost_usd"])
        if ref_cost > 0:
            advice["tier_vs_reference_savings_percent"] = round(
                max(0.0, (ref_cost - tier_cost) / ref_cost) * 100,
                1,
            )
            advice["tier_vs_reference_savings_label"] = format_usd(
                max(0.0, ref_cost - tier_cost)
            )

    return advice


def _suggest_vague_prompt(text: str) -> str:
    topic = _excerpt(text, 80).strip(" .")
    if len(topic) < 8 or VAGUE_PATTERNS.search(topic):
        topic = "the task below"
    return (
        f"Goal: resolve {topic}.\n"
        "Context: [add 2-3 relevant facts]\n"
        "Constraints: [stack, deadline, must-not-break rules]\n"
        "Output: [format, e.g. numbered steps or a code patch]"
    )


def _suggest_format_prompt(text: str) -> str:
    return (
        f"{_excerpt(text, 100)}\n\n"
        "Output format: respond in markdown with (1) summary, (2) steps, (3) final answer."
    )


def _suggest_decomposition_prompt(text: str) -> str:
    return (
        f"Break this into ordered subtasks before solving:\n"
        f"1. Understand: {_excerpt(text, 60)}\n"
        "2. Plan: list approach and risks\n"
        "3. Execute: complete subtask 1 only\n"
        "4. Verify: confirm before moving to subtask 2"
    )


def _suggest_concise_prompt(text: str) -> str:
    compressed = _compress_filler(text)
    if not CONCISENESS_PATTERNS.search(compressed):
        compressed = f"{compressed}\n\nKeep the response under 200 words unless more detail is required."
    return _bounded_suggestion(compressed)


def _suggest_reference_prior_turn(text: str, prior_turn_index: int) -> str:
    return (
        f"Following up on turn {prior_turn_index} (do not repeat that context):\n"
        f"{_excerpt(text, 150)}"
    )


def _suggest_privacy_prompt(text: str) -> str:
    redacted = PRIVACY_RISK_PATTERNS.sub("[REDACTED]", text)
    return (
        f"{_excerpt(redacted, 150)}\n\n"
        "Note: replace secrets with placeholders before sending to any AI tool."
    )


def _detect_turn_issues(
    turn: Turn,
    turn_tokens: int,
    *,
    encoding_name: str,
    median_user_tokens: float,
    prior_user_turn: Turn | None,
    prior_user_tokens: int,
) -> list[dict]:
    issues: list[dict] = []
    text = turn.content.strip()
    if turn.role != "user" or not text:
        return issues

    if VAGUE_PATTERNS.search(text) or (len(text.split()) < 8 and "?" not in text):
        issues.append(
            {
                "issue": "vague_request",
                "why": "The request lacks a clear goal, context, or expected output.",
                "suggested_prompt": _suggest_vague_prompt(text),
                "linked_dimension": "prompting_skills",
            }
        )

    if len(text.split()) >= 6 and not PROMPTING_PATTERNS.search(text) and not FORMAT_PATTERNS.search(text):
        issues.append(
            {
                "issue": "missing_format",
                "why": "No output format or structure is specified.",
                "suggested_prompt": _suggest_format_prompt(text),
                "linked_dimension": "prompting_skills",
            }
        )

    if turn_tokens >= max(400, median_user_tokens * 2.5):
        issues.append(
            {
                "issue": "context_dump",
                "why": "This turn is much longer than typical — consider summarizing context.",
                "suggested_prompt": _suggest_concise_prompt(text),
                "linked_dimension": "context_management",
            }
        )

    if (
        len(text.split()) >= 20
        and not DECOMPOSE_PATTERNS.search(text)
        and "?" in text
    ):
        issues.append(
            {
                "issue": "missing_decomposition",
                "why": "A large question without steps often leads to unfocused answers.",
                "suggested_prompt": _suggest_decomposition_prompt(text),
                "linked_dimension": "problem_decomposition",
            }
        )

    if ONE_SHOT_EXPECTATION.search(text):
        issues.append(
            {
                "issue": "one_shot_expectation",
                "why": "Expecting perfection on the first try usually increases back-and-forth.",
                "suggested_prompt": (
                    f"Draft a first version for: {_excerpt(text, 80)}. "
                    "I will refine in follow-up turns."
                ),
                "linked_dimension": "iteration",
            }
        )

    if PRIVACY_RISK_PATTERNS.search(text):
        issues.append(
            {
                "issue": "privacy_risk",
                "why": "Possible secrets detected — redact before using AI tools.",
                "suggested_prompt": _suggest_privacy_prompt(text),
                "linked_dimension": "privacy",
            }
        )

    if prior_user_turn is not None:
        overlap = _jaccard(_tokenize(prior_user_turn.content), _tokenize(text))
        if overlap >= 0.4 and prior_user_tokens >= 25 and turn_tokens >= 25:
            issues.append(
                {
                    "issue": "repeated_context",
                    "why": (
                        f"High overlap with turn {prior_user_turn.turn_index}; "
                        "reference earlier context instead of re-pasting."
                    ),
                    "suggested_prompt": _suggest_reference_prior_turn(
                        text, prior_user_turn.turn_index
                    ),
                    "linked_dimension": "context_management",
                    "overlap_ratio": round(overlap, 2),
                }
            )

    if turn_tokens >= 80:
        compressed = _compress_filler(text)
        if _count_tokens(compressed, encoding_name) < turn_tokens - 5 and compressed != text:
            issues.append(
                {
                    "issue": "verbose_prompt",
                    "why": "Filler words inflate token count without adding intent.",
                    "suggested_prompt": _bounded_suggestion(compressed),
                    "linked_dimension": "prompting_skills",
                }
            )

    if turn_tokens >= 120 and not CONCISENESS_PATTERNS.search(text):
        issues.append(
            {
                "issue": "missing_conciseness",
                "why": "No length constraint — the model may produce overly long replies.",
                "suggested_prompt": _suggest_concise_prompt(text),
                "linked_dimension": "context_management",
            }
        )

    return issues


def _estimate_duplicate_savings(
    turn: Turn,
    prior_turn: Turn,
    turn_tokens: int,
    prior_tokens: int,
    overlap: float,
) -> int:
    """Estimate tokens recoverable by referencing instead of repeating context."""
    return max(0, round(overlap * min(turn_tokens, prior_tokens) * 0.55))


def _build_token_savings_estimate(
    turns: list[Turn],
    tokens_by_turn: list[int],
    turn_suggestions: list[dict],
    encoding_name: str,
) -> dict:
    current_total = sum(tokens_by_turn)

    per_turn_savings: dict[int, int] = {}
    for suggestion in turn_suggestions:
        turn_index = suggestion["turn_index"]
        original = suggestion.get("original_tokens", 0)
        suggested = suggestion.get("suggested_tokens", 0)
        delta = max(0, original - suggested)
        per_turn_savings[turn_index] = max(per_turn_savings.get(turn_index, 0), delta)

    rewrite_savings = sum(per_turn_savings.values())

    duplicate_savings = 0
    prior_user: Turn | None = None
    prior_user_tokens = 0
    for turn, turn_tokens in zip(turns, tokens_by_turn):
        if turn.role == "user" and prior_user is not None:
            overlap = _jaccard(_tokenize(prior_user.content), _tokenize(turn.content))
            if overlap >= 0.4:
                duplicate_savings += _estimate_duplicate_savings(
                    turn, prior_user, turn_tokens, prior_user_tokens, overlap
                )
        if turn.role == "user":
            prior_user = turn
            prior_user_tokens = turn_tokens

    # Avoid double-counting duplicate savings already captured in repeated_context rewrites.
    duplicate_savings = max(0, duplicate_savings - rewrite_savings // 3)

    total_savings = min(current_total - 1, rewrite_savings + duplicate_savings)
    optimized_total = max(1, current_total - total_savings)
    savings_percent = round((total_savings / current_total) * 100, 1) if current_total else 0.0

    return {
        "current_total": current_total,
        "optimized_total": optimized_total,
        "savings_tokens": total_savings,
        "savings_percent": savings_percent,
        "rewrite_savings_tokens": rewrite_savings,
        "duplicate_context_savings_tokens": duplicate_savings,
        "encoding": encoding_name,
        "methodology": (
            "Savings sum per-turn rewrite deltas (best suggestion per turn) plus estimated "
            "duplicate-context reduction. Counts are computed with tiktoken, not an LLM."
        ),
    }


def _playbook_from_dimensions(dimensions: list[dict], limit: int = 4) -> list[str]:
    sorted_dims = sorted(dimensions, key=lambda item: item.get("score", 100))
    tips: list[str] = []
    for dim in sorted_dims:
        dim_id = dim.get("id", "")
        tip = DIMENSION_PLAYBOOK.get(dim_id)
        if tip and tip not in tips:
            tips.append(tip)
        if len(tips) >= limit:
            break
    return tips


def _playbook_from_dimensions(dimensions: list[dict], limit: int = 4) -> list[str]:
    sorted_dims = sorted(dimensions, key=lambda item: item.get("score", 100))
    tips: list[str] = []
    for dim in sorted_dims:
        dim_id = dim.get("id", "")
        tip = DIMENSION_PLAYBOOK.get(dim_id)
        if tip and tip not in tips:
            tips.append(tip)
        if len(tips) >= limit:
            break
    return tips


def _classify_task_type(user_turns: list[Turn]) -> tuple[str, float, str]:
    """Return (task_type_id, confidence 0-100, rationale)."""
    if not user_turns:
        return "general", 0.0, "No user messages to classify."

    scores: dict[str, float] = {
        "extraction": 0.0,
        "transformation": 0.0,
        "debugging": 0.0,
        "reasoning": 0.0,
        "creative": 0.0,
        "agentic": 0.0,
    }
    patterns = {
        "extraction": EXTRACTION_PATTERNS,
        "transformation": TRANSFORMATION_PATTERNS,
        "debugging": DEBUGGING_PATTERNS,
        "reasoning": REASONING_PATTERNS,
        "creative": CREATIVE_PATTERNS,
        "agentic": AGENTIC_PATTERNS,
    }
    for turn in user_turns:
        for task_id, pattern in patterns.items():
            if pattern.search(turn.content):
                scores[task_id] += 1.0

    total_hits = sum(scores.values())
    if total_hits == 0:
        return (
            "general",
            40.0,
            "No strong task-type signals — treated as a general Q&A session.",
        )

    best_id = max(scores, key=scores.get)
    confidence = min(100.0, round((scores[best_id] / len(user_turns)) * 100, 1))
    rationales = {
        "extraction": "Language suggests pulling structured data from text.",
        "transformation": "Session focuses on rewriting, formatting, or summarizing content.",
        "debugging": "Error-fixing and troubleshooting patterns detected.",
        "reasoning": "Architecture, comparison, or decision-making language detected.",
        "creative": "Drafting or generative writing patterns detected.",
        "agentic": "Multi-step agent or workflow orchestration patterns detected.",
    }
    return best_id, confidence, rationales.get(best_id, "")


def _dimension_score(dimensions: list[dict], dim_id: str, default: float = 70.0) -> float:
    for dim in dimensions:
        if dim.get("id") == dim_id:
            return float(dim.get("score", default))
    return default


def _compute_prompt_efficiency(
    *,
    user_tokens: int,
    user_turn_count: int,
    user_evaluation: dict,
    task_tier: str,
    token_savings: dict,
    cost_analysis: dict,
    recommendations: list[dict],
    turn_suggestions: list[dict],
    user_turn_list: list[Turn],
    turns: list[Turn],
) -> dict:
    prompt_quality = compute_prompt_quality(
        user_turn_list,
        turns,
        task_tier,
        turn_suggestions=turn_suggestions,
    )
    efficiency = compute_efficiency_grade(
        prompt_quality_score=prompt_quality["score"],
        user_tokens=user_tokens,
        task_tier=task_tier,
        user_turn_count=user_turn_count,
        token_savings=token_savings,
        user_reported_model=cost_analysis.get("user_reported_model"),
        detected_model=cost_analysis.get("detected_model"),
        tier_recommended_model=cost_analysis.get("tier_recommended_model"),
        recommendations=recommendations,
    )
    efficiency["ai_usage_score"] = float(user_evaluation.get("overall_score", 0))
    efficiency["prompt_quality_pillars"] = prompt_quality["pillars"]
    return efficiency


def _build_waste_buckets(
    turn_suggestions: list[dict],
    *,
    total_tokens: int,
    turn_count: int,
    user_evaluation: dict,
    model_advice: dict,
    token_savings: dict,
) -> list[dict]:
    buckets: dict[str, dict] = {
        "structural": {"issues": [], "estimated_tokens": 0},
        "instruction": {"issues": [], "estimated_tokens": 0},
        "conversation": {"issues": [], "estimated_tokens": 0},
        "model": {"issues": [], "estimated_tokens": 0},
    }

    for suggestion in turn_suggestions:
        issue = suggestion.get("issue", "")
        delta = max(0, suggestion.get("estimated_token_delta", 0))
        for bucket_id, issue_set in WASTE_BUCKET_ISSUES.items():
            if issue in issue_set:
                buckets[bucket_id]["issues"].append(issue)
                buckets[bucket_id]["estimated_tokens"] += delta

    duplicate = token_savings.get("duplicate_context_savings_tokens", 0)
    if duplicate > 0:
        buckets["structural"]["estimated_tokens"] += duplicate
        buckets["structural"]["issues"].append("duplicate_context")

    quality = float(user_evaluation.get("overall_score", 50))
    if turn_count >= 10 and quality < 68 and not buckets["conversation"]["issues"]:
        buckets["conversation"]["issues"].append("long_thread_low_quality")
        buckets["conversation"]["estimated_tokens"] += min(
            200, round(total_tokens * 0.05)
        )

    ref = model_advice.get("reference_model")
    tier_model = model_advice.get("tier_recommended_model")
    cost_fit = model_advice.get("cost_fit_recommended_model")
    if ref and tier_model and ref != tier_model:
        buckets["model"]["issues"].append("reference_over_tier")
    if ref and cost_fit and ref != cost_fit:
        buckets["model"]["issues"].append("reference_over_cost_fit")

    result: list[dict] = []
    labels = {
        "structural": "Structural waste",
        "instruction": "Instruction waste",
        "conversation": "Conversation waste",
        "model": "Model waste",
    }
    for bucket_id in ("structural", "instruction", "conversation", "model"):
        data = buckets[bucket_id]
        if not data["issues"]:
            continue
        unique_issues = sorted(set(data["issues"]))
        result.append(
            {
                "id": bucket_id,
                "label": labels[bucket_id],
                "causes": [issue.replace("_", " ") for issue in unique_issues],
                "fix": WASTE_BUCKET_FIXES[bucket_id],
                "estimated_tokens": data["estimated_tokens"],
            }
        )

    result.sort(key=lambda row: row["estimated_tokens"], reverse=True)
    return result


def _best_suggestion_per_turn(turn_suggestions: list[dict]) -> dict[int, dict]:
    """Pick one suggestion per turn — prefer highest token savings."""
    by_turn: dict[int, dict] = {}
    compress_issues = {"repeated_context", "verbose_prompt", "context_dump"}

    for suggestion in turn_suggestions:
        turn_index = suggestion["turn_index"]
        current = by_turn.get(turn_index)
        delta = suggestion.get("estimated_token_delta", 0)
        if current is None:
            by_turn[turn_index] = suggestion
            continue
        current_delta = current.get("estimated_token_delta", 0)
        if delta > current_delta:
            by_turn[turn_index] = suggestion
        elif delta == current_delta and suggestion.get("issue") in compress_issues:
            by_turn[turn_index] = suggestion

    return by_turn


def _build_optimized_session(
    turns: list[Turn],
    tokens_by_turn: list[int],
    turn_suggestions: list[dict],
    encoding_name: str,
) -> dict:
    """Simulate a session with best per-turn user prompt replacements."""
    current_total = sum(tokens_by_turn)
    best_by_turn = _best_suggestion_per_turn(turn_suggestions)
    compress_issues = {"repeated_context", "verbose_prompt", "context_dump"}

    optimized_contents: list[str] = []
    turns_optimized = 0
    for turn, turn_tokens in zip(turns, tokens_by_turn):
        if turn.role != "user":
            optimized_contents.append(turn.content)
            continue

        suggestion = best_by_turn.get(turn.turn_index)
        if not suggestion:
            optimized_contents.append(turn.content)
            continue

        delta = suggestion.get("estimated_token_delta", 0)
        issue = suggestion.get("issue", "")
        if delta > 0 or issue in compress_issues:
            optimized_contents.append(suggestion["suggested_prompt"])
            turns_optimized += 1
        else:
            optimized_contents.append(turn.content)

    optimized_total = sum(
        _count_tokens(content, encoding_name) for content in optimized_contents
    )
    savings_tokens = max(0, current_total - optimized_total)
    savings_percent = (
        round((savings_tokens / current_total) * 100, 1) if current_total else 0.0
    )

    return {
        "current_total": current_total,
        "optimized_total": optimized_total,
        "savings_tokens": savings_tokens,
        "savings_percent": savings_percent,
        "turns_optimized": turns_optimized,
        "encoding": encoding_name,
        "methodology": (
            "Rebuilds the session applying the best per-turn user prompt suggestion "
            "(token-reducing or compression fixes), then re-counts all turns with tiktoken."
        ),
    }


def _score_model_for_task(
    row: dict,
    *,
    task_type: str,
    task_tier: str,
    pick_mode: str,
) -> float:
    cost = float(row.get("est_input_cost_usd", 0))
    headroom = int(row.get("headroom_tokens", 0))
    score = 0.0

    if pick_mode == "economy":
        score += max(0.0, 50.0 - cost * 1_000_000)
        score += min(20.0, headroom / 5000)
    elif pick_mode == "premium":
        score += min(40.0, cost * 500_000)
        score += min(30.0, headroom / 3000)
        if row["model_id"] in TIER_MODEL_PREFERENCES.get("complex", []):
            score += 15
    else:
        tier_prefs = TIER_MODEL_PREFERENCES.get(task_tier, [])
        if row["model_id"] in tier_prefs:
            score += 30 - tier_prefs.index(row["model_id"]) * 3
        type_tier = {
            "extraction": "simple",
            "transformation": "simple",
            "creative": "simple",
            "debugging": "moderate",
            "reasoning": "complex",
            "agentic": "complex",
            "general": task_tier,
        }.get(task_type, task_tier)
        if row["model_id"] in TIER_MODEL_PREFERENCES.get(type_tier, []):
            score += 12
        score += max(0.0, 25.0 - cost * 800_000)
        score += min(15.0, headroom / 8000)

    return score


def _build_tiered_model_picks(
    *,
    task_type: str,
    task_tier: str,
    recommendations: list[dict],
    cost_analysis: dict,
) -> dict:
    fitting = [row for row in recommendations if row.get("fits")]
    if not fitting:
        return {
            "task_type": task_type,
            "task_type_label": TASK_TYPE_LABELS.get(task_type, task_type.title()),
            "picks": [],
            "note": "No model fits this transcript in the catalog.",
        }

    picks_meta = [
        (
            "economy",
            "Economy",
            "Cheapest model that still fits the context window.",
        ),
        (
            "recommended",
            "Recommended",
            "Best balance of task type, complexity tier, and cost.",
        ),
        (
            "premium",
            "Premium",
            "Highest-capability option when quality risk outweighs cost.",
        ),
    ]

    picks: list[dict] = []
    used_models: set[str] = set()

    for pick_id, label, description in picks_meta:
        ranked = sorted(
            fitting,
            key=lambda row: _score_model_for_task(
                row,
                task_type=task_type,
                task_tier=task_tier,
                pick_mode=pick_id,
            ),
            reverse=True,
        )
        chosen = None
        for row in ranked:
            if row["model_id"] not in used_models:
                chosen = row
                break
        if chosen is None:
            chosen = ranked[0]

        used_models.add(chosen["model_id"])
        cost = float(chosen["est_input_cost_usd"])
        ref_cost = float(cost_analysis.get("reference_cost_usd") or 0)
        vs_ref = (
            round(max(0.0, (ref_cost - cost) / ref_cost) * 100, 1) if ref_cost > 0 else 0.0
        )
        picks.append(
            {
                "id": pick_id,
                "label": label,
                "description": description,
                "model_id": chosen["model_id"],
                "provider": chosen["provider"],
                "est_input_cost_usd": round(cost, 8),
                "est_input_cost_label": format_usd(cost),
                "headroom_tokens": chosen.get("headroom_tokens"),
                "savings_vs_reference_percent": vs_ref,
            }
        )

    return {
        "task_type": task_type,
        "task_type_label": TASK_TYPE_LABELS.get(task_type, task_type.title()),
        "picks": picks,
        "note": (
            "Economy minimizes cost; Recommended matches task type and complexity; "
            "Premium favors capability for demanding reasoning or agentic work."
        ),
    }


def build_prompting_recommendations(
    turns: list[Turn],
    *,
    tokens_by_turn: list[int],
    total_tokens: int,
    user_tokens: int | None = None,
    max_turn_tokens: int,
    encoding_name: str,
    user_evaluation: dict,
    cost_analysis: dict,
    recommendations: list[dict],
    task_profile: dict | None = None,
    use_llm: bool = False,
    llm_coach_model: str = "openai/gpt-4o-mini",
    embedding_model: str = "openai/text-embedding-3-small",
) -> dict:
    _ = use_llm, llm_coach_model, embedding_model
    user_turn_list = _user_turns(turns)
    if user_tokens is None:
        user_tokens = sum(
            count for turn, count in zip(turns, tokens_by_turn) if turn.role == "user"
        )
    user_token_counts = [
        count for turn, count in zip(turns, tokens_by_turn) if turn.role == "user"
    ]
    median_user_tokens = float(median(user_token_counts)) if user_token_counts else 0.0

    if task_profile:
        task_tier = task_profile["complexity_tier"]
        task_score = task_profile["complexity_score"]
        task_rationale = task_profile["complexity_rationale"]
    else:
        task_tier, task_score, task_rationale = classify_task_complexity(
            turns,
            user_turn_list,
            total_tokens,
            max_turn_tokens,
        )
    model_advice = _build_model_advice(
        task_tier,
        task_score,
        task_rationale,
        recommendations,
        cost_analysis,
    )

    raw_suggestions: list[dict] = []
    prior_user: Turn | None = None
    prior_user_tokens = 0

    for turn, turn_tokens in zip(turns, tokens_by_turn):
        if turn.role != "user":
            continue

        for issue in _detect_turn_issues(
            turn,
            turn_tokens,
            encoding_name=encoding_name,
            median_user_tokens=median_user_tokens,
            prior_user_turn=prior_user,
            prior_user_tokens=prior_user_tokens,
        ):
            suggested = issue["suggested_prompt"]
            suggested_tokens = _count_tokens(suggested, encoding_name)
            raw_suggestions.append(
                {
                    "turn_index": turn.turn_index,
                    "issue": issue["issue"],
                    "why": issue["why"],
                    "original_excerpt": _excerpt(turn.content),
                    "suggested_prompt": suggested,
                    "original_tokens": turn_tokens,
                    "suggested_tokens": suggested_tokens,
                    "estimated_token_delta": turn_tokens - suggested_tokens,
                    "linked_dimension": issue.get("linked_dimension"),
                    "overlap_ratio": issue.get("overlap_ratio"),
                }
            )

        prior_user = turn
        prior_user_tokens = turn_tokens

    # Keep the highest-savings suggestion per turn+issue type.
    seen: set[tuple[int, str]] = set()
    turn_suggestions: list[dict] = []
    for item in sorted(
        raw_suggestions,
        key=lambda row: (
            ISSUE_PRIORITY.get(row["issue"], 99),
            -row.get("estimated_token_delta", 0),
        ),
    ):
        key = (item["turn_index"], item["issue"])
        if key in seen:
            continue
        seen.add(key)
        turn_suggestions.append(item)

    turn_suggestions.sort(
        key=lambda row: (
            ISSUE_PRIORITY.get(row["issue"], 99),
            row["turn_index"],
        )
    )
    turn_suggestions = turn_suggestions[:8]

    token_savings = _build_token_savings_estimate(
        turns,
        tokens_by_turn,
        turn_suggestions,
        encoding_name,
    )
    optimized_session = _build_optimized_session(
        turns,
        tokens_by_turn,
        turn_suggestions,
        encoding_name,
    )
    if optimized_session["savings_tokens"] > token_savings.get("savings_tokens", 0):
        token_savings = {
            **token_savings,
            "optimized_total": optimized_session["optimized_total"],
            "savings_tokens": optimized_session["savings_tokens"],
            "savings_percent": optimized_session["savings_percent"],
            "session_simulation": optimized_session,
        }
    else:
        token_savings = {**token_savings, "session_simulation": optimized_session}

    task_type, task_type_confidence, task_type_rationale = _classify_task_type(
        user_turn_list
    )
    tiered_models = _build_tiered_model_picks(
        task_type=task_type,
        task_tier=task_tier,
        recommendations=recommendations,
        cost_analysis=cost_analysis,
    )
    model_advice["task_type"] = task_type
    model_advice["task_type_label"] = TASK_TYPE_LABELS.get(task_type, task_type.title())
    model_advice["task_type_confidence"] = task_type_confidence
    model_advice["task_type_rationale"] = task_type_rationale
    model_advice["tiered_picks"] = tiered_models.get("picks", [])

    dimensions = user_evaluation.get("dimensions", [])
    prompt_efficiency = _compute_prompt_efficiency(
        user_tokens=user_tokens,
        user_turn_count=len(user_turn_list),
        user_evaluation=user_evaluation,
        task_tier=task_tier,
        token_savings=token_savings,
        cost_analysis=cost_analysis,
        recommendations=recommendations,
        turn_suggestions=turn_suggestions,
        user_turn_list=user_turn_list,
        turns=turns,
    )
    waste_buckets = _build_waste_buckets(
        turn_suggestions,
        total_tokens=total_tokens,
        turn_count=len(turns),
        user_evaluation=user_evaluation,
        model_advice=model_advice,
        token_savings=token_savings,
    )

    playbook_tips = _playbook_from_dimensions(dimensions)
    weakest = min(dimensions, key=lambda d: d.get("score", 100), default=None)

    parts: list[str] = [prompt_efficiency["verdict"].rstrip(".")]
    if task_type != "general":
        parts.append(
            f"task type '{TASK_TYPE_LABELS.get(task_type, task_type)}' detected"
        )
    if optimized_session["savings_tokens"] > 0:
        parts.append(
            f"optimized session could save {optimized_session['savings_tokens']} tokens "
            f"({optimized_session['savings_percent']}%)"
        )
    elif turn_suggestions:
        parts.append(f"{len(turn_suggestions)} prompt improvement(s) identified")

    summary = "This session: " + "; ".join(parts) + "."

    return {
        "summary": summary,
        "focus_dimension": weakest["label"] if weakest else None,
        "focus_dimension_score": weakest["score"] if weakest else None,
        "prompt_efficiency": prompt_efficiency,
        "session_profile": {
            "prompt_quality": {
                "score": prompt_efficiency.get("prompting_quality_score"),
                "pillars": prompt_efficiency.get("prompt_quality_pillars"),
            },
            "efficiency": {
                "score": prompt_efficiency.get("efficiency_score"),
                "grade": prompt_efficiency.get("grade"),
                "breakdown": prompt_efficiency.get("breakdown"),
                "factors": prompt_efficiency.get("efficiency_factors"),
            },
            "ai_usage_score": prompt_efficiency.get("ai_usage_score"),
        },
        "task_type": {
            "id": task_type,
            "label": TASK_TYPE_LABELS.get(task_type, task_type.title()),
            "confidence": task_type_confidence,
            "rationale": task_type_rationale,
        },
        "waste_buckets": waste_buckets,
        "optimized_session": optimized_session,
        "tiered_model_picks": tiered_models,
        "token_savings_estimate": token_savings,
        "model_advice": model_advice,
        "turn_suggestions": turn_suggestions,
        "playbook_tips": playbook_tips,
        "methodology": (
            "Rule-based prompting coach (no LLM). Includes prompt efficiency scoring, "
            "waste-bucket diagnosis, optimized session simulation, task-type classification, "
            "and economy/recommended/premium model picks."
        ),
    }

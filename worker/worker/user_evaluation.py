import re

from worker.parser import Turn

WORD_RE = re.compile(r"[a-z0-9']+")

# --- signal patterns (user turns) ---
VAGUE_PATTERNS = re.compile(
    r"\b(help|fix it|idk|dunno|just do it|figure it out)\b",
    re.I,
)
PROMPTING_PATTERNS = re.compile(
    r"(\bbecause\b|\bexample\b|\bformat\b|\bstep\b|^\s*[-*]\d|:\s*\n|please\s+\w+)",
    re.I | re.M,
)
LIMITATION_AWARE_PATTERNS = re.compile(
    r"\b(verify|double.?check|confirm|might be wrong|hallucinat|not sure if|"
    r"can you check|human review|may be incorrect|don't trust)\b",
    re.I,
)
DECOMPOSE_PATTERNS = re.compile(
    r"\b(first|second|then|next|step\s*\d|break.*down|separately|part\s*\d|"
    r"one at a time|split into)\b",
    re.I,
)
TOOL_CHOICE_PATTERNS = re.compile(
    r"\b(gpt|claude|openai|anthropic|model|api|chatbot|copilot|gemini|llm|"
    r"tool|platform|integration)\b",
    re.I,
)
ITERATION_PATTERNS = re.compile(
    r"\b(refine|revise|improve|update|try again|adjust|iterate|edit|"
    r"make it better|can you change|not quite)\b",
    re.I,
)
CONTEXT_PATTERNS = re.compile(
    r"(\bcontext\b|as (mentioned|discussed)|earlier|background|attached|"
    r"@[\w.-]+\.\w{2,}|\bID\b|\bticket\b|\binvoice\b)",
    re.I,
)
TECH_SOFTWARE_PATTERNS = re.compile(
    r"\b(code|api|deploy|bug|error|database|server|frontend|backend|git|sql|python)\b",
    re.I,
)
TECH_DATA_AI_PATTERNS = re.compile(
    r"\b(token|dataset|model|embedding|prompt|inference|ml|ai|analytics|vector)\b",
    re.I,
)
TECH_BUSINESS_PATTERNS = re.compile(
    r"\b(billing|subscription|roi|revenue|customer|pricing|plan|invoice|kpi)\b",
    re.I,
)
VERIFY_DEBUG_PATTERNS = re.compile(
    r"\b(test|debug|validate|trace|log|incorrect|doesn't work|not working|"
    r"root cause|fix|troubleshoot)\b",
    re.I,
)
AUTOMATION_PATTERNS = re.compile(
    r"\b(automate|workflow|webhook|pipeline|script|cron|integrate|zapier|"
    r"batch|scheduled)\b",
    re.I,
)
AGENT_PATTERNS = re.compile(
    r"\b(agent|autonomous|multi.?step|handoff|escalat|tool use|subtask)\b",
    re.I,
)
PRIVACY_GOOD_PATTERNS = re.compile(
    r"\b(redact|last four|ending in|\*\*\*|do not share|sensitive|mask)\b",
    re.I,
)
PRIVACY_RISK_PATTERNS = re.compile(
    r"\b(password|ssn|social security|credit card number|\b\d{16}\b|api[_ ]?key\s*[:=])",
    re.I,
)
QUALITY_MEASURE_PATTERNS = re.compile(
    r"\b(accuracy|quality|metric|score|evaluate|assess|review|summary|qa|"
    r"benchmark|compare|rate this)\b",
    re.I,
)
ONE_SHOT_EXPECTATION = re.compile(
    r"\b(perfect|exactly right|first try|one shot|immediately correct)\b",
    re.I,
)

DIMENSION_DESCRIPTIONS: dict[str, str] = {
    "ai_limitations": (
        "Good AI users know AI can make mistakes, hallucinate, and need verification."
    ),
    "problem_decomposition": (
        "Strong users break big problems into smaller tasks."
    ),
    "tool_choice": "A good user knows which tool fits.",
    "iteration": "Good users don't expect the first output to be perfect.",
    "context_management": (
        'Advanced users give AI context. Bad: "Fix this code". '
        'Good: "This is a FastAPI project. Error during login. Here is the structure and log."'
    ),
    "technical_knowledge": (
        "AI is more powerful when combined with domain knowledge."
    ),
    "verification_debugging": "Good AI users know how to debug AI output.",
    "automation": "Advanced users connect AI with workflows.",
    "agent_understanding": (
        'Understanding agents improves prompting. Basic: "Answer customer questions". '
        'Advanced: "Build an agent that retrieves data, checks orders, and creates tickets."'
    ),
    "privacy": (
        "Don't put sensitive data into AI — passwords, private customer data, company secrets."
    ),
    "output_quality": (
        "Good AI users evaluate accuracy, relevance, speed, cost, and reliability."
    ),
    "redundancy_detection": (
        "Detects when a prompt repeats the same intent as earlier turns, wasting tokens."
    ),
}


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def _tokenize(text: str) -> set[str]:
    return {m.group(0) for m in WORD_RE.finditer(text.lower()) if len(m.group(0)) > 2}


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def _user_turns(turns: list[Turn]) -> list[Turn]:
    return [t for t in turns if t.role == "user"]


def _match_ratio(user_turns: list[Turn], pattern: re.Pattern[str]) -> float:
    if not user_turns:
        return 0.0
    hits = sum(1 for t in user_turns if pattern.search(t.content))
    return hits / len(user_turns)


def _score_prompting_skills(user_turns: list[Turn]) -> tuple[float, str]:
    if not user_turns:
        return 0.0, "No user messages to assess."

    scores: list[float] = []
    for turn in user_turns:
        text = turn.content.strip()
        words = text.split()
        s = 52.0
        if len(words) >= 8:
            s += 14
        if PROMPTING_PATTERNS.search(text):
            s += 20
        if "?" in text:
            s += 6
        if len(text) < 10 or VAGUE_PATTERNS.search(text):
            s -= 22
        scores.append(_clamp(s))

    avg = sum(scores) / len(scores)
    note = (
        "Prompts are structured with clear goals and constraints."
        if avg >= 75
        else "Use clearer instructions, examples, and expected output format."
    )
    return round(avg, 1), note


def _score_ai_limitations(user_turns: list[Turn]) -> tuple[float, str]:
    ratio = _match_ratio(user_turns, LIMITATION_AWARE_PATTERNS)
    blind_trust = _match_ratio(user_turns, ONE_SHOT_EXPECTATION)
    score = _clamp(58 + ratio * 42 - blind_trust * 25)
    note = (
        "User shows awareness that AI output may need verification."
        if score >= 75
        else "Encourage confirming facts and treating AI answers as drafts, not truth."
    )
    return round(score, 1), note


def _score_problem_decomposition(user_turns: list[Turn]) -> tuple[float, str]:
    if not user_turns:
        return 0.0, "No user messages to assess."

    decompose_hits = _match_ratio(user_turns, DECOMPOSE_PATTERNS)
    avg_words = sum(len(t.content.split()) for t in user_turns) / len(user_turns)

    # Multiple focused turns often indicate decomposition vs one giant blob
    focus_bonus = min(18, len(user_turns) * 2) if avg_words < 45 else 0
    score = _clamp(50 + decompose_hits * 45 + focus_bonus)
    note = (
        "Problems are broken into steps or smaller requests."
        if score >= 75
        else "Split large goals into smaller, ordered tasks for better AI results."
    )
    return round(score, 1), note


def _score_tool_choice(
    user_turns: list[Turn],
    cost_analysis: dict,
) -> tuple[float, str]:
    tool_mentions = _match_ratio(user_turns, TOOL_CHOICE_PATTERNS)
    reference = cost_analysis.get("reference_model")
    recommended = cost_analysis.get("recommended_model")
    savings_pct = float(cost_analysis.get("savings_percent") or 0)

    if reference and recommended and reference == recommended:
        score = _clamp(88 + tool_mentions * 10)
        note = f"Transcript aligns with a cost-efficient choice ({recommended})."
    elif savings_pct >= 50:
        score = _clamp(45 + tool_mentions * 25)
        note = (
            f"Session reference model ({reference}) costs more than needed; "
            f"{recommended} fits this transcript at lower cost."
        )
    elif savings_pct >= 15:
        score = _clamp(62 + tool_mentions * 20)
        note = (
            f"Moderate savings possible: {recommended} vs {reference} "
            f"for this token volume."
        )
    else:
        score = _clamp(70 + tool_mentions * 15)
        note = (
            f"Current reference ({reference}) is reasonable for this transcript size."
        )
    return round(score, 1), note


def _score_iteration(user_turns: list[Turn]) -> tuple[float, str]:
    if len(user_turns) < 2:
        return 72.0, "Limited turns to assess iterative refinement."

    iter_ratio = _match_ratio(user_turns, ITERATION_PATTERNS)
    # Progressive refinement: later turns overlap with earlier but aren't duplicates
    refine_signals = 0
    for i in range(1, len(user_turns)):
        overlap = _jaccard(_tokenize(user_turns[i - 1].content), _tokenize(user_turns[i].content))
        if 0.2 < overlap < 0.65:
            refine_signals += 1

    refine_ratio = refine_signals / (len(user_turns) - 1)
    one_shot = _match_ratio(user_turns, ONE_SHOT_EXPECTATION)
    score = _clamp(55 + iter_ratio * 30 + refine_ratio * 25 - one_shot * 20)
    note = (
        "User refines outputs step by step instead of expecting perfection immediately."
        if score >= 75
        else "Iterate on AI responses: clarify, correct, and improve across turns."
    )
    return round(score, 1), note


def _score_context_management(user_turns: list[Turn]) -> tuple[float, str]:
    ratio = _match_ratio(user_turns, CONTEXT_PATTERNS)
    rich = sum(1 for t in user_turns if len(t.content.split()) >= 12)
    rich_ratio = rich / len(user_turns) if user_turns else 0
    score = _clamp(48 + ratio * 40 + rich_ratio * 28)
    note = (
        "User supplies background, references, and identifiers the AI needs."
        if score >= 75
        else "Provide earlier context, IDs, and constraints in each major request."
    )
    return round(score, 1), note


def _score_technical_knowledge(user_turns: list[Turn]) -> tuple[float, str]:
    if not user_turns:
        return 0.0, "No user messages to assess."

    sw = _match_ratio(user_turns, TECH_SOFTWARE_PATTERNS)
    data = _match_ratio(user_turns, TECH_DATA_AI_PATTERNS)
    biz = _match_ratio(user_turns, TECH_BUSINESS_PATTERNS)
    domains = sum(1 for r in (sw, data, biz) if r > 0)

    score = _clamp(45 + sw * 22 + data * 18 + biz * 18 + domains * 8)
    areas = []
    if sw > 0:
        areas.append("software development")
    if data > 0:
        areas.append("data/AI")
    if biz > 0:
        areas.append("business")
    area_text = ", ".join(areas) if areas else "general topics only"
    note = (
        f"Domain vocabulary detected ({area_text}), strengthening AI collaboration."
        if score >= 75
        else "Combine AI with domain terms from software, data/AI, or business context."
    )
    return round(score, 1), note


def _score_verification_debugging(user_turns: list[Turn]) -> tuple[float, str]:
    ratio = _match_ratio(user_turns, VERIFY_DEBUG_PATTERNS)
    score = _clamp(55 + ratio * 45)
    note = (
        "User tests, validates, or debugs AI output rather than accepting it blindly."
        if score >= 75
        else "Ask the AI to verify steps, reproduce issues, and validate fixes."
    )
    return round(score, 1), note


def _score_automation(user_turns: list[Turn]) -> tuple[float, str]:
    ratio = _match_ratio(user_turns, AUTOMATION_PATTERNS)
    score = _clamp(62 + ratio * 38)
    note = (
        "User thinks in workflows and connecting AI to broader automation."
        if score >= 75
        else "Explore integrating AI into pipelines, APIs, or scheduled workflows."
    )
    return round(score, 1), note


def _score_agent_understanding(user_turns: list[Turn], turns: list[Turn]) -> tuple[float, str]:
    user_ratio = _match_ratio(user_turns, AGENT_PATTERNS)
    agent_turns = sum(1 for t in turns if t.role == "agent")
    multi_turn = len(user_turns) >= 3 and agent_turns >= 3
    score = _clamp(58 + user_ratio * 35 + (12 if multi_turn else 0))
    note = (
        "User engages with multi-turn agent behavior and handoffs appropriately."
        if score >= 75
        else "Treat AI as an agent: assign subtasks and review intermediate steps."
    )
    return round(score, 1), note


def _score_privacy(user_turns: list[Turn]) -> tuple[float, str]:
    good = _match_ratio(user_turns, PRIVACY_GOOD_PATTERNS)
    risk = _match_ratio(user_turns, PRIVACY_RISK_PATTERNS)
    score = _clamp(78 + good * 22 - risk * 55)
    note = (
        "Sensitive data handling appears cautious; redaction patterns observed."
        if score >= 75
        else "Avoid sharing passwords, full card numbers, or secrets with AI tools."
    )
    return round(score, 1), note


def _score_output_quality(user_turns: list[Turn]) -> tuple[float, str]:
    ratio = _match_ratio(user_turns, QUALITY_MEASURE_PATTERNS)
    asks_summary = sum(1 for t in user_turns if re.search(r"\bsummar", t.content, re.I))
    bonus = min(15, asks_summary * 8)
    score = _clamp(54 + ratio * 40 + bonus)
    note = (
        "User explicitly measures or reviews output quality and accuracy."
        if score >= 75
        else "Request summaries, metrics, or QA checks to judge AI output quality."
    )
    return round(score, 1), note


def _score_redundancy_detection(user_turns: list[Turn]) -> tuple[float, str]:
    from worker.similarity import redundancy_matrix, redundancy_score_from_edges

    if len(user_turns) < 2:
        return 85.0, "Not enough user turns to assess redundancy."

    edges = redundancy_matrix(user_turns, use_embeddings=False, threshold=0.55)
    score = redundancy_score_from_edges(len(user_turns), edges)
    if score >= 75:
        note = "User prompts show little repeated intent across the session."
    elif score >= 55:
        note = "Some prompts repeat earlier context — reference prior turns instead."
    else:
        note = "Multiple prompts repeat the same intent — consolidate or reference earlier turns."
    return score, note


def _cost_comparison(cost_analysis: dict) -> dict:
    """Legacy shape for PDF sections that read user_eval.cost_comparison."""
    if not cost_analysis or not cost_analysis.get("reference_model"):
        return {}
    return {
        "assumed_model": cost_analysis.get("reference_model"),
        "recommended_model": cost_analysis.get("recommended_model"),
        "assumed_cost_usd": cost_analysis.get("reference_cost_usd", 0),
        "optimized_cost_usd": cost_analysis.get("recommended_cost_usd", 0),
        "potential_savings_usd": cost_analysis.get("savings_usd", 0),
        "potential_savings_percent": cost_analysis.get("savings_percent", 0),
        "reference_cost_label": cost_analysis.get("reference_cost_label"),
        "recommended_cost_label": cost_analysis.get("recommended_cost_label"),
        "savings_label": cost_analysis.get("savings_label"),
        "reference_source": cost_analysis.get("reference_source"),
        "user_reported_model": cost_analysis.get("user_reported_model"),
        "detected_model": cost_analysis.get("detected_model"),
        "session_tokens": cost_analysis.get("session_tokens"),
        "model_comparisons": cost_analysis.get("model_comparisons", []),
        "note": cost_analysis.get("note"),
    }


def _grade_from_score(score: float) -> str:
    if score >= 90:
        return "Excellent"
    if score >= 75:
        return "Good"
    if score >= 60:
        return "Fair"
    if score >= 45:
        return "Needs improvement"
    return "Poor"


def _written_summary(dimensions: list[dict], overall: float) -> str:
    strongest = max(dimensions, key=lambda d: d["score"])
    weakest = min(dimensions, key=lambda d: d["score"])
    return (
        f"This session scores {overall}% overall for AI tool usage. "
        f"The strongest skill area is {strongest['label'].lower()} ({strongest['score']}%). "
        f"The main growth area is {weakest['label'].lower()} ({weakest['score']}%). "
        "Scores are derived from transcript patterns and do not use an LLM judge."
    )


def evaluate_user_ai_usage(
    turns: list[Turn],
    model_recommendations: list[dict],
    cost_analysis: dict,
) -> dict:
    user_turns = _user_turns(turns)

    scorers = [
        (
            "ai_limitations",
            "Understanding AI limitations",
            _score_ai_limitations(user_turns),
        ),
        (
            "problem_decomposition",
            "Problem decomposition",
            _score_problem_decomposition(user_turns),
        ),
        (
            "tool_choice",
            "Choosing right AI tool",
            _score_tool_choice(user_turns, cost_analysis),
        ),
        ("iteration", "Iteration ability", _score_iteration(user_turns)),
        ("context_management", "Context management", _score_context_management(user_turns)),
        (
            "technical_knowledge",
            "AI + technical knowledge",
            _score_technical_knowledge(user_turns),
        ),
        (
            "verification_debugging",
            "Verification & debugging",
            _score_verification_debugging(user_turns),
        ),
        ("automation", "Automation skills", _score_automation(user_turns)),
        (
            "agent_understanding",
            "Understanding AI agents",
            _score_agent_understanding(user_turns, turns),
        ),
        ("privacy", "Data privacy awareness", _score_privacy(user_turns)),
        ("output_quality", "Measuring output quality", _score_output_quality(user_turns)),
        (
            "redundancy_detection",
            "Redundancy detection",
            _score_redundancy_detection(user_turns),
        ),
    ]

    dimensions = [
        {
            "id": dim_id,
            "label": label,
            "score": score,
            "description": DIMENSION_DESCRIPTIONS.get(dim_id, ""),
            "detail": detail,
        }
        for dim_id, label, (score, detail) in scorers
    ]

    weights = {d["id"]: 1 / 12 for d in dimensions}
    overall = round(sum(d["score"] * weights[d["id"]] for d in dimensions), 1)

    insights: list[str] = []
    sorted_dims = sorted(dimensions, key=lambda d: d["score"])
    insights.append(
        f"Strongest: {sorted_dims[-1]['label']} ({sorted_dims[-1]['score']}%)."
    )
    insights.append(
        f"Focus next: {sorted_dims[0]['label']} ({sorted_dims[0]['score']}%)."
    )
    if sorted_dims[0]["score"] < 65:
        insights.append(sorted_dims[0]["detail"])

    cost_comparison = _cost_comparison(cost_analysis)
    savings_pct = float(cost_comparison.get("potential_savings_percent") or 0)
    if savings_pct >= 10 and cost_comparison.get("recommended_model"):
        insights.append(
            f"For this transcript ({cost_comparison.get('session_tokens', 0)} tokens), "
            f"{cost_comparison['recommended_model']} ({cost_comparison.get('recommended_cost_label')}) "
            f"vs {cost_comparison['assumed_model']} ({cost_comparison.get('reference_cost_label')}) "
            f"saves {savings_pct}% ({cost_comparison.get('savings_label')})."
        )

    return {
        "overall_score": overall,
        "grade": _grade_from_score(overall),
        "dimensions": dimensions,
        "written_summary": _written_summary(dimensions, overall),
        "insights": insights,
        "cost_comparison": cost_comparison,
        "methodology": (
            "Twelve-skill heuristic analysis of user messages (no LLM). "
            "Signals include verification language, decomposition, iteration, "
            "domain vocabulary, privacy patterns, output-quality checks, and redundancy."
        ),
    }

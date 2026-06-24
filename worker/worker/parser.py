import re
from dataclasses import dataclass


SEPARATOR_PATTERN = re.compile(r"^[-─=_*]{3,}$")
NUMBERED_TURN_HEADER = re.compile(
    r"^\[\d+\]\s*(user|customer|human|client|agent|assistant|bot|ai|support)\b",
    re.I,
)
EXPORT_METADATA = re.compile(
    r"^(_Exported on\b|exported on\b)",
    re.I | re.M,
)

MARKDOWN_BOLD_USER = re.compile(r"^\*\*(user|you)\*\*\s*$", re.I | re.M)
MARKDOWN_BOLD_AGENT = re.compile(
    r"^\*\*(cursor|chatgpt|assistant|agent|ai|bot|copilot|gpt)\*\*\s*$",
    re.I | re.M,
)
MARKDOWN_BOLD_SPLIT = re.compile(
    r"(?m)^\*\*(User|You|Cursor|ChatGPT|Assistant|Agent|AI|Bot|Copilot|GPT)\*\*\s*$",
    re.I,
)

USER_ROLE_NAMES = frozenset({"user", "you", "customer", "human", "client"})
AGENT_ROLE_NAMES = frozenset(
    {
        "agent",
        "assistant",
        "bot",
        "ai",
        "support",
        "cursor",
        "chatgpt",
        "copilot",
        "gpt",
    }
)

# Classic transcripts: User:, [1] User, # User, etc.
CLASSIC_ROLE_PATTERNS = [
    (
        re.compile(
            r"^\[\d+\]\s*(user|customer|human|client)(?:\s|\(|$)",
            re.I,
        ),
        "user",
    ),
    (
        re.compile(
            r"^\[\d+\]\s*(agent|assistant|bot|ai|support|cursor|chatgpt|copilot)(?:\s|\(|$)",
            re.I,
        ),
        "agent",
    ),
    (re.compile(r"^(user|you)\s+said:\s*", re.I), "user"),
    (
        re.compile(r"^(chatgpt|assistant|agent|ai|cursor|copilot)\s+said:\s*", re.I),
        "agent",
    ),
    (re.compile(r"^(user|customer|human|client)\s*:\s*", re.I), "user"),
    (
        re.compile(
            r"^(agent|assistant|bot|ai|support|cursor|chatgpt|copilot|gpt)\s*:\s*",
            re.I,
        ),
        "agent",
    ),
    (re.compile(r"^#{1,3}\s*(user|customer|you)\s*$", re.I), "user"),
    (
        re.compile(r"^#{1,3}\s*(agent|assistant|cursor|chatgpt|ai|bot)\s*$", re.I),
        "agent",
    ),
    (re.compile(r"^(user|customer|human|you)\s*$", re.I), "user"),
    (
        re.compile(
            r"^(agent|assistant|cursor|chatgpt)(?:\s*\([^)]*\))?\s*$",
            re.I,
        ),
        "agent",
    ),
]


@dataclass
class Turn:
    role: str
    content: str
    turn_index: int


def _normalize_role_name(name: str) -> str:
    key = name.strip().lower()
    if key in USER_ROLE_NAMES:
        return "user"
    if key in AGENT_ROLE_NAMES:
        return "agent"
    return "user"


def _clean_turn_content(content: str) -> str:
    lines = content.replace("\r\n", "\n").split("\n")
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and SEPARATOR_PATTERN.match(lines[0].strip()):
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()
    while lines and SEPARATOR_PATTERN.match(lines[-1].strip()):
        lines.pop()
    return "\n".join(lines).strip()


def is_cursor_markdown_export(text: str) -> bool:
    """True for Cursor / ChatGPT markdown exports with **User** / **Cursor** headers."""
    return _is_markdown_export(text)


def _is_markdown_export(text: str) -> bool:
    has_bold_user = bool(MARKDOWN_BOLD_USER.search(text))
    has_bold_agent = bool(MARKDOWN_BOLD_AGENT.search(text))
    has_export_line = bool(EXPORT_METADATA.search(text))
    return (has_bold_user and has_bold_agent) or (has_export_line and has_bold_user)


def _parse_markdown_bold_export(text: str) -> tuple[list[Turn], list[str]]:
    """
    Cursor / ChatGPT markdown exports use top-level **User** and **Cursor** lines.
    Split only on those headers so inline User: / # User inside replies are ignored.
    """
    warnings: list[str] = [
        "Parsed as markdown export (**User** / **Cursor** or **ChatGPT** headers)"
    ]
    normalized = text.replace("\r\n", "\n")
    match = MARKDOWN_BOLD_USER.search(normalized)
    if not match:
        return [], warnings
    if match.start() > 0:
        warnings.append("Skipped export header/metadata before first role marker")

    body = normalized[match.start() :]
    parts = MARKDOWN_BOLD_SPLIT.split(body)
    if len(parts) < 2:
        return [], warnings

    turns: list[Turn] = []
    turn_index = 0
    role_name: str | None = None

    for part in parts:
        stripped = part.strip()
        if not stripped:
            continue
        key = stripped.lower()
        if key in USER_ROLE_NAMES or key in AGENT_ROLE_NAMES:
            role_name = key
            continue
        if role_name is None:
            continue
        content = _clean_turn_content(part)
        if not content:
            continue
        turn_index += 1
        turns.append(
            Turn(
                role=_normalize_role_name(role_name),
                content=content,
                turn_index=turn_index,
            )
        )
        role_name = None

    return turns, warnings


def _is_classic_role_marker(stripped: str) -> bool:
    if not stripped:
        return False
    for pattern, _ in CLASSIC_ROLE_PATTERNS:
        if pattern.match(stripped):
            return True
    return False


def _strip_export_preamble(lines: list[str]) -> tuple[list[str], list[str]]:
    warnings: list[str] = []
    for index, line in enumerate(lines):
        stripped = line.strip()
        if _is_classic_role_marker(stripped):
            if index > 0:
                warnings.append(
                    "Skipped export header/metadata before first role marker"
                )
            return lines[index:], warnings
    return lines, warnings


def _looks_like_export_metadata(block: str) -> bool:
    lines = [line.strip() for line in block.split("\n") if line.strip()]
    if not lines:
        return True
    if len(lines) <= 3 and all(
        line.startswith("#") or EXPORT_METADATA.match(line) for line in lines
    ):
        return True
    return False


def _parse_separator_blocks(text: str) -> tuple[list[Turn], list[str]]:
    warnings = [
        "No role labels found; inferred user/agent from --- separators (alternating turns)"
    ]
    chunks = [chunk.strip() for chunk in re.split(r"\n-{3,}\n", text) if chunk.strip()]
    chunks = [chunk for chunk in chunks if not _looks_like_export_metadata(chunk)]
    if len(chunks) < 2:
        return [], warnings

    turns: list[Turn] = []
    for index, chunk in enumerate(chunks):
        role = "user" if index % 2 == 0 else "agent"
        turns.append(Turn(role=role, content=chunk, turn_index=index + 1))
    return turns, warnings


def _parse_line_oriented(text: str) -> tuple[list[Turn], list[str]]:
    warnings: list[str] = []
    lines = text.replace("\r\n", "\n").split("\n")
    lines, preamble_warnings = _strip_export_preamble(lines)
    warnings.extend(preamble_warnings)

    turns: list[Turn] = []
    current_role: str | None = None
    current_lines: list[str] = []
    turn_index = 0
    seen_numbered_turn = False

    def flush() -> None:
        nonlocal turn_index, current_role, current_lines
        if current_role and current_lines:
            content = "\n".join(current_lines).strip()
            if content:
                turn_index += 1
                turns.append(
                    Turn(role=current_role, content=content, turn_index=turn_index)
                )
        current_role = None
        current_lines = []

    for line in lines:
        stripped = line.strip()
        if stripped and SEPARATOR_PATTERN.match(stripped):
            if current_role and current_lines:
                flush()
            continue

        matched = False
        for pattern, role in CLASSIC_ROLE_PATTERNS:
            if pattern.match(stripped):
                if NUMBERED_TURN_HEADER.match(stripped) and not seen_numbered_turn:
                    seen_numbered_turn = True
                    current_role = None
                    current_lines = []
                    warnings = [
                        w
                        for w in warnings
                        if "before first role label" not in w
                    ]
                flush()
                current_role = role
                remainder = pattern.sub("", stripped).strip()
                if remainder:
                    current_lines.append(remainder)
                matched = True
                break
        if not matched:
            if current_role is None:
                if seen_numbered_turn:
                    continue
                if stripped:
                    warnings.append(
                        "Lines before first role label were assigned to 'user'"
                    )
                    current_role = "user"
                    current_lines.append(stripped)
            else:
                current_lines.append(line)

    flush()
    return turns, warnings


def parse_transcript(text: str) -> tuple[list[Turn], list[str]]:
    """Parse plain text or markdown chat transcripts into user/agent turns."""
    stripped = text.replace("\r\n", "\n").strip()
    if not stripped:
        return [], []

    warnings: list[str] = []
    turns: list[Turn] = []

    if _is_markdown_export(stripped):
        turns, warnings = _parse_markdown_bold_export(stripped)

    if not turns:
        turns, warnings = _parse_line_oriented(stripped)

    agent_turns = sum(1 for turn in turns if turn.role == "agent")
    if agent_turns == 0 and re.search(r"\n-{3,}\n", stripped):
        block_turns, block_warnings = _parse_separator_blocks(stripped)
        if len(block_turns) >= 2 and sum(1 for t in block_turns if t.role == "agent") > 0:
            return block_turns, block_warnings

    if not turns:
        turns.append(Turn(role="user", content=stripped, turn_index=1))
        warnings.append("No role labels found; treating entire file as one user turn")
    elif agent_turns == 0:
        warnings.append(
            "No agent turns detected; agent token count will be 0 for this transcript"
        )

    return turns, warnings

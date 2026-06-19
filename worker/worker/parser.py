import re
from dataclasses import dataclass


ROLE_PATTERNS = [
    (re.compile(r"^(user|customer|human|client)\s*:\s*", re.I), "user"),
    (re.compile(r"^(agent|assistant|bot|ai|support)\s*:\s*", re.I), "agent"),
    (re.compile(r"^#{1,3}\s*(user|customer)\s*$", re.I), "user"),
    (re.compile(r"^#{1,3}\s*(agent|assistant)\s*$", re.I), "agent"),
]


@dataclass
class Turn:
    role: str
    content: str
    turn_index: int


def parse_transcript(text: str) -> tuple[list[Turn], list[str]]:
    """Parse plain text or markdown chat transcripts into user/agent turns."""
    warnings: list[str] = []
    lines = text.replace("\r\n", "\n").split("\n")
    turns: list[Turn] = []
    current_role: str | None = None
    current_lines: list[str] = []
    turn_index = 0

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
        matched = False
        for pattern, role in ROLE_PATTERNS:
            match = pattern.match(line.strip())
            if match:
                flush()
                current_role = role
                if ":" in line:
                    remainder = pattern.sub("", line.strip()).strip()
                    if remainder:
                        current_lines.append(remainder)
                matched = True
                break
        if not matched:
            if current_role is None:
                stripped = line.strip()
                if stripped:
                    warnings.append(
                        "Lines before first role label were assigned to 'user'"
                    )
                    current_role = "user"
                    current_lines.append(stripped)
            else:
                current_lines.append(line)

    flush()

    if not turns:
        stripped = text.strip()
        if stripped:
            warnings.append("No role labels found; treating entire file as one user turn")
            turns.append(Turn(role="user", content=stripped, turn_index=1))

    return turns, warnings

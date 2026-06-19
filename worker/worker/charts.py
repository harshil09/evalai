import io

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt


def tokens_by_turn_chart(tokens_by_turn: list[dict]) -> bytes:
    if not tokens_by_turn:
        return _empty_chart("No turns to chart")

    indices = [item["turn_index"] for item in tokens_by_turn]
    tokens = [item["tokens"] for item in tokens_by_turn]
    colors = ["#2563eb" if item["role"] == "user" else "#7c3aed" for item in tokens_by_turn]

    fig, ax = plt.subplots(figsize=(8, 4))
    ax.bar(indices, tokens, color=colors)
    ax.set_xlabel("Turn")
    ax.set_ylabel("Tokens")
    ax.set_title("Tokens per turn")
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()
    return _fig_to_png(fig)


def role_share_chart(user_tokens: int, agent_tokens: int) -> bytes:
    if user_tokens + agent_tokens == 0:
        return _empty_chart("No tokens to chart")

    fig, ax = plt.subplots(figsize=(5, 5))
    ax.pie(
        [user_tokens, agent_tokens],
        labels=["User", "Agent"],
        autopct="%1.1f%%",
        colors=["#2563eb", "#7c3aed"],
        startangle=90,
    )
    ax.set_title("Token share by role")
    fig.tight_layout()
    return _fig_to_png(fig)


def _fig_to_png(fig: plt.Figure) -> bytes:
    buffer = io.BytesIO()
    fig.savefig(buffer, format="png", dpi=120)
    plt.close(fig)
    buffer.seek(0)
    return buffer.read()


def user_evaluation_bar_chart(dimensions: list[dict]) -> bytes:
    if not dimensions:
        return _empty_chart("No evaluation data")

    labels = [item["label"] for item in dimensions]
    scores = [item["score"] for item in dimensions]
    bar_colors = [
        "#16a34a" if score >= 75 else "#2563eb" if score >= 60 else "#f59e0b" if score >= 45 else "#dc2626"
        for score in scores
    ]

    height = max(5.5, len(labels) * 0.42)
    fig, ax = plt.subplots(figsize=(8, height))
    y_pos = range(len(labels))
    ax.barh(list(y_pos), scores, color=bar_colors, height=0.7)
    ax.set_yticks(list(y_pos))
    ax.set_yticklabels(labels, fontsize=9)
    ax.set_xlim(0, 100)
    ax.set_xlabel("Score (%)")
    ax.set_title("How well the user uses AI tools", fontsize=11, fontweight="bold")
    ax.axvline(x=75, color="#a1a1aa", linestyle="--", linewidth=1, alpha=0.8, label="Good (75%)")
    for index, score in enumerate(scores):
        ax.text(min(score + 1.2, 96), index, f"{score:.0f}%", va="center", fontsize=8)
    ax.grid(axis="x", alpha=0.25)
    fig.tight_layout()
    return _fig_to_png(fig)


def _empty_chart(message: str) -> bytes:
    fig, ax = plt.subplots(figsize=(6, 3))
    ax.text(0.5, 0.5, message, ha="center", va="center")
    ax.axis("off")
    return _fig_to_png(fig)

import io
import math

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

# Soft, eye-friendly palette for charts
CHART_COLORS = [
    "#7c6df0",
    "#5b9bd5",
    "#6ecbaa",
    "#f4b860",
    "#e87878",
    "#9b8ec4",
    "#4db8c4",
    "#c4a86e",
    "#8fbc8f",
    "#d48cb3",
    "#87aade",
    "#c9a96e",
]


def tokens_by_turn_chart(tokens_by_turn: list[dict]) -> bytes:
    if not tokens_by_turn:
        return _empty_chart("No turns to chart")

    indices = [item["turn_index"] for item in tokens_by_turn]
    tokens = [item["tokens"] for item in tokens_by_turn]
    bar_colors = [
        "#5b7fd6" if item["role"] == "user" else "#8b6fd6" for item in tokens_by_turn
    ]

    fig, ax = plt.subplots(figsize=(8, 4))
    ax.bar(indices, tokens, color=bar_colors, edgecolor="white", linewidth=0.4)
    ax.set_xlabel("Turn", fontsize=9)
    ax.set_ylabel("Tokens", fontsize=9)
    ax.set_title("Tokens per turn", fontsize=11, fontweight="bold", color="#374151")
    ax.grid(axis="y", alpha=0.25, color="#d1d5db")
    ax.set_facecolor("#fafafa")
    fig.patch.set_facecolor("white")
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
        colors=["#5b7fd6", "#8b6fd6"],
        startangle=90,
        wedgeprops={"edgecolor": "white", "linewidth": 1},
        textprops={"fontsize": 9},
    )
    ax.set_title("Token share by role", fontsize=11, fontweight="bold", color="#374151")
    fig.patch.set_facecolor("white")
    fig.tight_layout()
    return _fig_to_png(fig)


def nightingale_chart(
    dimensions: list[dict],
    *,
    title: str = "AI usage skills",
) -> bytes:
    """Rose / Nightingale chart for dimension scores."""
    if not dimensions:
        return _empty_chart("No evaluation data")

    labels = [item["label"] for item in dimensions]
    scores = [float(item["score"]) for item in dimensions]
    n = len(labels)
    theta = np.linspace(0, 2 * np.pi, n, endpoint=False)
    width = 2 * np.pi / n

    colors = [CHART_COLORS[i % len(CHART_COLORS)] for i in range(n)]

    fig, ax = plt.subplots(figsize=(6.5, 6.5), subplot_kw={"projection": "polar"})
    bars = ax.bar(
        theta,
        scores,
        width=width * 0.92,
        bottom=0,
        color=colors,
        edgecolor="white",
        linewidth=0.8,
        alpha=0.92,
    )
    ax.set_ylim(0, 100)
    ax.set_yticks([25, 50, 75, 100])
    ax.set_yticklabels(["25", "50", "75", "100"], fontsize=7, color="#6b7280")
    ax.set_xticks(theta)
    ax.set_xticklabels(labels, fontsize=7.5, color="#374151")
    ax.set_title(title, fontsize=11, fontweight="bold", color="#374151", pad=18)
    ax.grid(color="#e5e7eb", alpha=0.8)
    ax.set_facecolor("#fafafa")
    fig.patch.set_facecolor("white")

    for angle, score, bar in zip(theta, scores, bars):
        ax.text(
            angle,
            min(score + 6, 98),
            f"{score:.0f}",
            ha="center",
            va="center",
            fontsize=7,
            color="#1f2937",
        )

    fig.tight_layout()
    return _fig_to_png(fig)


def user_evaluation_bar_chart(dimensions: list[dict]) -> bytes:
    if not dimensions:
        return _empty_chart("No evaluation data")

    labels = [item["label"] for item in dimensions]
    scores = [item["score"] for item in dimensions]
    bar_colors = [
        CHART_COLORS[i % len(CHART_COLORS)] for i, score in enumerate(scores)
    ]

    height = max(5.5, len(labels) * 0.42)
    fig, ax = plt.subplots(figsize=(8, height))
    y_pos = range(len(labels))
    ax.barh(list(y_pos), scores, color=bar_colors, height=0.7, edgecolor="white")
    ax.set_yticks(list(y_pos))
    ax.set_yticklabels(labels, fontsize=9, color="#374151")
    ax.set_xlim(0, 100)
    ax.set_xlabel("Score (%)", fontsize=9)
    ax.set_title(
        "How effectively the user uses AI tools",
        fontsize=11,
        fontweight="bold",
        color="#374151",
    )
    ax.axvline(x=75, color="#a1a1aa", linestyle="--", linewidth=1, alpha=0.8)
    for index, score in enumerate(scores):
        ax.text(min(score + 1.2, 96), index, f"{score:.0f}%", va="center", fontsize=8)
    ax.grid(axis="x", alpha=0.25, color="#d1d5db")
    ax.set_facecolor("#fafafa")
    fig.patch.set_facecolor("white")
    fig.tight_layout()
    return _fig_to_png(fig)


def _fig_to_png(fig: plt.Figure) -> bytes:
    buffer = io.BytesIO()
    fig.savefig(buffer, format="png", dpi=120, facecolor=fig.get_facecolor())
    plt.close(fig)
    buffer.seek(0)
    return buffer.read()


def _empty_chart(message: str) -> bytes:
    fig, ax = plt.subplots(figsize=(6, 3))
    ax.text(0.5, 0.5, message, ha="center", va="center", color="#6b7280")
    ax.axis("off")
    fig.patch.set_facecolor("white")
    return _fig_to_png(fig)

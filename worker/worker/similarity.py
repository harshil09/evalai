"""All-pairs user-turn redundancy detection via lexical + optional semantic similarity."""

from __future__ import annotations

import hashlib
import re
from collections import defaultdict
from itertools import combinations

from worker.openrouter_client import get_openrouter_client
from worker.parser import Turn
from worker.user_evaluation import _jaccard, _tokenize

WORD_RE = re.compile(r"[a-z0-9']+")
TRIGRAM_RE = re.compile(r"(?=(.{3}))")


def _normalize(text: str) -> str:
    return " ".join(text.lower().split())


def _text_hash(text: str) -> str:
    return hashlib.sha256(_normalize(text).encode("utf-8")).hexdigest()


def _char_trigrams(text: str) -> set[str]:
    cleaned = _normalize(text)
    if len(cleaned) < 3:
        return {cleaned} if cleaned else set()
    return {m.group(1) for m in TRIGRAM_RE.finditer(cleaned)}


def build_user_turn_pairs(user_turns: list[Turn]) -> list[tuple[Turn, Turn]]:
    return list(combinations(user_turns, 2))


def lexical_similarity(a: str, b: str) -> float:
    word_j = _jaccard(_tokenize(a), _tokenize(b))
    tri_a = _char_trigrams(a)
    tri_b = _char_trigrams(b)
    tri_j = _jaccard(tri_a, tri_b) if tri_a and tri_b else 0.0
    return max(word_j, tri_j)


def semantic_similarity(
    a: str,
    b: str,
    embed_cache: dict[str, list[float]],
    *,
    embedding_model: str = "openai/text-embedding-3-small",
) -> float:
    """Cosine similarity on embeddings; returns 0.0 on cache miss without API call."""
    key_a = _text_hash(a)
    key_b = _text_hash(b)
    vec_a = embed_cache.get(key_a)
    vec_b = embed_cache.get(key_b)
    if vec_a is None or vec_b is None:
        return 0.0
    dot = sum(x * y for x, y in zip(vec_a, vec_b))
    norm_a = sum(x * x for x in vec_a) ** 0.5
    norm_b = sum(x * x for x in vec_b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _combined_score(lexical: float, semantic: float) -> float:
    return 0.45 * lexical + 0.55 * semantic


def populate_embeddings(
    texts: list[str],
    embed_cache: dict[str, list[float]],
    *,
    embedding_model: str = "openai/text-embedding-3-small",
) -> None:
    """Fetch embeddings via OpenRouter; failures leave cache unchanged."""
    client = get_openrouter_client()
    if client is None:
        return

    pending: list[tuple[str, str]] = []
    for text in texts:
        key = _text_hash(text)
        if key not in embed_cache:
            pending.append((key, _normalize(text)))

    if not pending:
        return

    try:
        batch_size = 64
        for start in range(0, len(pending), batch_size):
            chunk = pending[start : start + batch_size]
            response = client.embeddings.create(
                model=embedding_model,
                input=[item[1] for item in chunk],
            )
            for (key, _), row in zip(chunk, response.data):
                embed_cache[key] = list(row.embedding)
    except Exception:
        return


def redundancy_matrix(
    user_turns: list[Turn],
    *,
    embed_cache: dict[str, list[float]] | None = None,
    threshold: float = 0.72,
    lexical_prefilter: float = 0.25,
    embedding_model: str = "openai/text-embedding-3-small",
    use_embeddings: bool = False,
) -> list[dict]:
    """
    Return edges where combined similarity >= threshold.
    Each edge: turn_a, turn_b, turn_index_a, turn_index_b, lexical, semantic, combined.
    """
    if embed_cache is None:
        embed_cache = {}

    edges: list[dict] = []
    pairs_needing_embed: list[str] = []

    for turn_a, turn_b in build_user_turn_pairs(user_turns):
        lex = lexical_similarity(turn_a.content, turn_b.content)
        if lex < lexical_prefilter:
            continue
        if use_embeddings:
            pairs_needing_embed.extend([turn_a.content, turn_b.content])
        else:
            combined = lex
            if combined >= threshold:
                edges.append(
                    {
                        "turn_index_a": turn_a.turn_index,
                        "turn_index_b": turn_b.turn_index,
                        "turn_a": turn_a.turn_index,
                        "turn_b": turn_b.turn_index,
                        "lexical": round(lex, 3),
                        "semantic": 0.0,
                        "combined": round(combined, 3),
                    }
                )

    if use_embeddings and pairs_needing_embed:
        populate_embeddings(pairs_needing_embed, embed_cache, embedding_model=embedding_model)
        for turn_a, turn_b in build_user_turn_pairs(user_turns):
            lex = lexical_similarity(turn_a.content, turn_b.content)
            if lex < lexical_prefilter:
                continue
            sem = semantic_similarity(
                turn_a.content, turn_b.content, embed_cache, embedding_model=embedding_model
            )
            combined = _combined_score(lex, sem)
            if combined >= threshold:
                edges.append(
                    {
                        "turn_index_a": turn_a.turn_index,
                        "turn_index_b": turn_b.turn_index,
                        "turn_a": turn_a.turn_index,
                        "turn_b": turn_b.turn_index,
                        "lexical": round(lex, 3),
                        "semantic": round(sem, 3),
                        "combined": round(combined, 3),
                    }
                )

    return edges


def cluster_redundant_turns(edges: list[dict]) -> list[dict]:
    """Connected components from redundancy edges."""
    if not edges:
        return []

    parent: dict[int, int] = {}

    def find(node: int) -> int:
        parent.setdefault(node, node)
        if parent[node] != node:
            parent[node] = find(parent[node])
        return parent[node]

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    for edge in edges:
        union(edge["turn_index_a"], edge["turn_index_b"])

    clusters: dict[int, set[int]] = defaultdict(set)
    for edge in edges:
        root = find(edge["turn_index_a"])
        clusters[root].add(edge["turn_index_a"])
        clusters[root].add(edge["turn_index_b"])

    result: list[dict] = []
    for idx, members in enumerate(sorted(clusters.values(), key=lambda s: min(s)), start=1):
        sorted_members = sorted(members)
        result.append(
            {
                "cluster_id": idx,
                "turn_indices": sorted_members,
                "size": len(sorted_members),
            }
        )
    return result


def redundancy_score_from_edges(user_turn_count: int, edges: list[dict]) -> float:
    """Higher score = less redundant (fewer redundant pairs)."""
    if user_turn_count < 2:
        return 85.0
    max_pairs = user_turn_count * (user_turn_count - 1) / 2
    redundant_ratio = len(edges) / max_pairs if max_pairs else 0.0
    return round(max(0.0, min(100.0, 100.0 - redundant_ratio * 120)), 1)

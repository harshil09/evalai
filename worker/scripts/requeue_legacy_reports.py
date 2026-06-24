#!/usr/bin/env python3
"""Re-queue completed evaluations that used the legacy PDF format or bad markdown parse."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from worker.supabase_client import get_supabase_client  # noqa: E402
from worker.version import REPORT_FORMAT_VERSION  # noqa: E402


def needs_requeue(row: dict) -> bool:
    summary = row.get("evaluation_summary") or {}
    if summary.get("report_format_version", 0) >= REPORT_FORMAT_VERSION:
        return False
    filename = (row.get("original_filename") or "").lower()
    if not filename.endswith(".md"):
        return False
    # Legacy worker collapsed Cursor exports into a single user turn.
    return summary.get("turn_count") == 1


def main() -> int:
    client = get_supabase_client()
    response = (
        client.table("evaluations")
        .select("id, original_filename, status, evaluation_summary")
        .eq("status", "completed")
        .order("created_at", desc=True)
        .limit(100)
        .execute()
    )
    rows = response.data or []
    targets = [row for row in rows if needs_requeue(row)]
    if not targets:
        print("No legacy-format evaluations found.")
        return 0

    print(f"Re-queuing {len(targets)} evaluation(s):")
    for row in targets:
        print(f"  - {row.get('original_filename')} ({row['id']})")
        client.table("evaluations").update(
            {
                "status": "pending",
                "report_path": None,
                "evaluation_summary": None,
                "error_message": None,
                "completed_at": None,
            }
        ).eq("id", row["id"]).execute()

    print("Done. Restart the worker if needed; jobs will be reprocessed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

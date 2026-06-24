import fcntl
import logging
import os
import signal
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from worker.app_settings import load_app_settings
from worker.config import get_settings
from worker.parser import parse_transcript
from worker.processor import process_evaluation
from worker.supabase_client import get_supabase_client
from worker.version import REPORT_FORMAT_VERSION, REPORT_TITLE


def _run_job(job: dict) -> None:
    client = get_supabase_client()
    process_evaluation(client, job)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("worker")

_shutdown = False
_lock_handle = None

_CURSOR_EXPORT_SAMPLE = (
    "# Demo\n\n---\n\n**User**\n\nHello\n\n---\n\n**Cursor**\n\nHi there\n"
)


def _acquire_worker_lock() -> None:
    """Only one worker process at a time — avoids old/new code racing on batch uploads."""
    global _lock_handle
    lock_path = Path(
        os.environ.get(
            "WORKER_LOCK_PATH",
            Path(__file__).resolve().parent.parent / ".worker.lock",
        )
    )
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    _lock_handle = open(lock_path, "w", encoding="utf-8")
    try:
        fcntl.flock(_lock_handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        logger.error(
            "Another EvalAI worker is already running. Stop it before starting a new one — "
            "if two workers run together (old + new code), uploads get mixed PDF formats."
        )
        sys.exit(1)
    _lock_handle.write(str(os.getpid()))
    _lock_handle.flush()


def _verify_worker_capabilities() -> None:
    turns, _ = parse_transcript(_CURSOR_EXPORT_SAMPLE)
    agent_turns = sum(1 for turn in turns if turn.role == "agent")
    if len(turns) < 2 or agent_turns == 0:
        logger.error(
            "Cursor markdown parser self-test failed (%s turns, %s agent). "
            "Restart the worker after pulling the latest code.",
            len(turns),
            agent_turns,
        )
        sys.exit(1)
    if REPORT_TITLE != "AI Tool usage analyzer" or REPORT_FORMAT_VERSION < 2:
        logger.error(
            "Outdated report template (title=%r, format_version=%s). "
            "Use the current worker code.",
            REPORT_TITLE,
            REPORT_FORMAT_VERSION,
        )
        sys.exit(1)


def _handle_signal(signum, frame) -> None:
    global _shutdown
    logger.info("Received signal %s, shutting down after current jobs...", signum)
    _shutdown = True


def claim_job(client):
    try:
        response = client.rpc(
            "claim_evaluation",
            {"p_worker_format_version": REPORT_FORMAT_VERSION},
        ).execute()
    except Exception as exc:
        message = str(exc)
        if "p_worker_format_version" in message or "claim_evaluation" in message:
            logger.warning(
                "Versioned claim_evaluation unavailable (%s). "
                "Run supabase/migration_worker_format_version.sql so old workers stop claiming jobs.",
                exc,
            )
            response = client.rpc("claim_evaluation").execute()
        else:
            raise
    rows = response.data or []
    return rows[0] if rows else None


def recover_stale_jobs(client) -> None:
    try:
        response = client.rpc("recover_stale_evaluations", {"stale_minutes": 30}).execute()
        count = response.data
        if count:
            logger.info("Recovered %s stale evaluation(s)", count)
    except Exception as exc:
        logger.warning("Stale job recovery failed: %s", exc)


def run_worker() -> None:
    _acquire_worker_lock()
    _verify_worker_capabilities()

    settings = get_settings()
    client = get_supabase_client()
    app_settings, _ = load_app_settings(client, force_refresh=True)
    poll_interval = settings["poll_interval_seconds"]
    max_workers = settings["max_concurrent_jobs"]

    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    logger.info(
        "Worker started (poll=%ss, max_concurrent=%s, report=%r, format_version=%s, "
        "enable_llm_coach=%s)",
        poll_interval,
        max_workers,
        REPORT_TITLE,
        REPORT_FORMAT_VERSION,
        app_settings.get("enable_llm_coach"),
    )

    last_recovery = 0.0

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        active_jobs: set = set()

        while not _shutdown:
            now = time.time()
            if now - last_recovery > 600:
                recover_stale_jobs(client)
                last_recovery = now

            done = {future for future in active_jobs if future.done()}
            for future in done:
                try:
                    future.result()
                except Exception as exc:
                    logger.exception("Job failed: %s", exc)
            active_jobs -= done

            while len(active_jobs) < max_workers and not _shutdown:
                job = claim_job(client)
                if not job:
                    break
                future = executor.submit(_run_job, job)
                active_jobs.add(future)

            time.sleep(poll_interval)

        logger.info("Waiting for %s active job(s) to finish...", len(active_jobs))
        for future in active_jobs:
            future.result()


def main() -> None:
    try:
        run_worker()
    except KeyboardInterrupt:
        logger.info("Interrupted")
        sys.exit(0)


if __name__ == "__main__":
    main()

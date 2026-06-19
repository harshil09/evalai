import logging
import signal
import sys
import time
from concurrent.futures import ThreadPoolExecutor

from worker.config import get_settings
from worker.processor import process_evaluation
from worker.supabase_client import get_supabase_client


def _run_job(job: dict) -> None:
    client = get_supabase_client()
    process_evaluation(client, job)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("worker")

_shutdown = False


def _handle_signal(signum, frame) -> None:
    global _shutdown
    logger.info("Received signal %s, shutting down after current jobs...", signum)
    _shutdown = True


def claim_job(client):
    response = client.rpc("claim_evaluation").execute()
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
    settings = get_settings()
    client = get_supabase_client()
    poll_interval = settings["poll_interval_seconds"]
    max_workers = settings["max_concurrent_jobs"]

    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    logger.info(
        "Worker started (poll=%ss, max_concurrent=%s)",
        poll_interval,
        max_workers,
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

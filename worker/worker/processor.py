import logging
from datetime import datetime, timezone

#Client is the main object used to communicate with Supabase services.
from supabase import Client

#used for token analysis
from worker.analytics import analyze_transcript
from worker.app_settings import load_app_settings
from worker.model_catalog import load_model_catalog

#converts chat into structured objects 
from worker.parser import parse_transcript
#Imports PDF generator.
from worker.pdf_report import build_pdf_report

logger = logging.getLogger(__name__)

#Supabase storage bucket names.
TRANSCRIPTS_BUCKET = "transcripts"
REPORTS_BUCKET = "reports"


def transcript_exists(client: Client, path: str) -> bool:
    try:
        folder = "/".join(path.split("/")[:-1])
        filename = path.split("/")[-1]
        result = (
            client.storage.from_(TRANSCRIPTS_BUCKET)
            .list(folder, {"search": filename, "limit": 1})
        )
        return any(item.get("name") == filename for item in result)
    except Exception:
        return False


def download_transcript(client: Client, path: str) -> bytes:
    return client.storage.from_(TRANSCRIPTS_BUCKET).download(path)


def upload_report(client: Client, path: str, pdf_bytes: bytes) -> None:
    client.storage.from_(REPORTS_BUCKET).upload(
        path,
        pdf_bytes,
        file_options={"content-type": "application/pdf", "upsert": "true"},
    )


def mark_failed(client: Client, evaluation_id: str, message: str) -> None:
    client.table("evaluations").update(
        {
            "status": "failed",
            "error_message": message[:500],
        }
    ).eq("id", evaluation_id).execute()


def mark_completed(
    client: Client,
    evaluation_id: str,
    report_path: str,
    summary: dict,
) -> None:
    client.table("evaluations").update(
        {
            "status": "completed",
            "report_path": report_path,
            "evaluation_summary": summary,
            "error_message": None,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", evaluation_id).execute()


def process_evaluation(client: Client, job: dict) -> None:
    evaluation_id = job["id"]
    user_id = job["user_id"]
    transcript_path = job["transcript_path"]
    filename = job.get("original_filename") or job.get("title") or "transcript"

    logger.info("Processing evaluation %s", evaluation_id)

    if not transcript_exists(client, transcript_path):
        logger.info("Transcript not ready yet for %s, returning to pending", evaluation_id)
        client.table("evaluations").update({"status": "pending"}).eq(
            "id", evaluation_id
        ).execute()
        return

    try:
        raw_bytes = download_transcript(client, transcript_path)
        text = raw_bytes.decode("utf-8")
    except Exception as exc:
        mark_failed(client, evaluation_id, f"Could not read transcript: {exc}")
        return

    turns, warnings = parse_transcript(text)
    if not turns:
        mark_failed(client, evaluation_id, "Transcript contained no parseable content")
        return

    user_reported_model = (job.get("user_reported_model") or "").strip() or None

    app_settings, settings_meta = load_app_settings(client)
    catalog, catalog_meta = load_model_catalog(
        client,
        cache_seconds=app_settings["model_catalog_cache_seconds"],
    )
    summary = analyze_transcript(
        turns,
        warnings,
        catalog=catalog,
        reserved_output_tokens=app_settings["reserved_output_tokens"],
        default_reference_model=app_settings["default_reference_model"],
        user_reported_model=user_reported_model,
    )
    summary["catalog_source"] = catalog_meta["source"]
    summary["catalog_fetched_at"] = catalog_meta["fetched_at"]
    summary["settings_source"] = settings_meta["source"]
    summary["settings_fetched_at"] = settings_meta["fetched_at"]
    pdf_bytes = build_pdf_report(
        title=job.get("title") or filename,
        filename=filename,
        summary=summary,
    )

    report_path = f"{user_id}/{evaluation_id}/report.pdf"
    try:
        upload_report(client, report_path, pdf_bytes)
    except Exception as exc:
        mark_failed(client, evaluation_id, f"Could not upload report: {exc}")
        return

    mark_completed(client, evaluation_id, report_path, summary)
    logger.info("Completed evaluation %s", evaluation_id)

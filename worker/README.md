# TranscriptIQ — Python Worker

Background worker for transcript token analysis and PDF report generation. See the **[root README](../README.md)** for how the worker fits into the full system.

## What it does

1. Polls Supabase for `pending` evaluations (`claim_evaluation` RPC).
2. Downloads the transcript from the `transcripts` storage bucket.
3. Parses user/agent turns, counts tokens with tiktoken, ranks models by context fit.
4. Generates charts (matplotlib) and a PDF report (ReportLab).
5. Uploads the PDF to the `reports` bucket and marks the job `completed`.

The worker **polls the database** — it is not notified when a file is uploaded to Storage. If a job is claimed before the upload finishes, it resets to `pending` and retries.

## Setup

1. Run `supabase/schema.sql` then `supabase/migration_worker.sql` in the Supabase SQL Editor.
2. Copy `.env.example` to `.env` and set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m worker.main
```

## Docker (optional)

```bash
docker build -t evalai-worker .
docker run --env-file .env evalai-worker
```

## Deploy

Run on **Railway**, **Render**, or **Fly.io** — not Vercel. Use plain Python (`python -m worker.main`) or the Dockerfile. See [root README — Deployment](../README.md#deployment).

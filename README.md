# EvalAI

Upload chat transcripts between a **user** and an **agent**, get deterministic **token analysis** (no LLM), and download a **PDF report** with statistics and charts.

Built with **Next.js**, **Supabase**, and a **Python background worker**.

---

## What it does

1. **Sign up / sign in** via Supabase Auth.
2. **Upload** a `.txt` or `.md` transcript (lines labeled `User:` and `Agent:`).
3. **Track** evaluation status on the dashboard: Queued → Processing → Completed.
4. **Download** a PDF report with:
   - Total tokens and per-role breakdown (user vs agent)
   - Tokens per turn (bar chart)
   - Token share by role (pie chart)
   - Model fit table (which models fit in context window + estimated input cost)
5. **Free vs Pro plans:**
   - **Free:** 5 uploads per calendar month
   - **Pro:** Unlimited uploads (dummy checkout flow for demo)

Analysis is **rule-based** using [tiktoken](https://github.com/openai/tiktoken). Optional **LLM coaching** (`ENABLE_LLM_COACH=true` on the worker) enriches flagged turns only — it never blocks job completion.

Set `OPENROUTER_API_KEY` in `worker/.env` when enabling the hybrid LLM coach stage (uses [OpenRouter](https://openrouter.ai/) with OpenAI-compatible models).

---

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   Browser   │────▶│  Next.js (Vercel) │────▶│      Supabase       │
│  Dashboard  │     │  API routes       │     │  Postgres + Storage │
└──────┬──────┘     └──────────────────┘     └──────────┬──────────┘
       │                                                  │
       │  direct upload                                   │ poll & claim jobs
       └─────────────────────────────────────────────────▶│
                                                          │
                                               ┌──────────▼──────────┐
                                               │   Python worker     │
                                               │  (Railway / Render) │
                                               └─────────────────────┘
```

| Component | Technology | Role |
|-----------|------------|------|
| **Frontend + API** | Next.js 16, React, Tailwind | UI, auth, create jobs, Pro upgrade, signed PDF URLs |
| **Backend data** | Supabase | Auth, Postgres, Storage, Realtime |
| **Worker** | Python 3.12 | Parse transcripts, count tokens, generate PDF |

The worker does **not** talk to Next.js. **Supabase** is the shared layer: the database is the job queue, Storage holds files.

---

## How it works

### Upload flow

1. User selects a file on the dashboard and clicks **Upload & analyze**.
2. **Next.js** (`POST /api/evaluations`) calls Supabase RPC `create_evaluation_job`:
   - Enforces free-tier limit (5/month) or allows Pro unlimited
   - Inserts an `evaluations` row with `status: pending`
   - Sets `transcript_path` to `{user_id}/{evaluation_id}/{filename}`
3. **Browser** uploads the file directly to Supabase Storage (`transcripts` bucket).
4. Dashboard shows the job as **Queued**.

### Worker flow

The worker is a **long-running process** that **polls** the database every few seconds (it is not notified by Storage when a file lands).

1. Calls RPC `claim_evaluation()` — atomically picks the oldest `pending` row and sets `status: processing` (`SKIP LOCKED` for safe multi-worker scaling).
2. Checks whether the transcript file exists in Storage (if the user is still uploading, sets status back to `pending` and retries later).
3. Downloads the transcript, parses user/agent turns.
4. Counts tokens with tiktoken and ranks models from a static catalog.
5. Builds charts (matplotlib) and a PDF (ReportLab).
6. Uploads PDF to the `reports` bucket.
7. Updates the row: `status: completed`, `report_path`, `evaluation_summary` (JSON).

### Download flow

1. Dashboard listens for row changes via **Supabase Realtime**.
2. User clicks **Download PDF**.
3. Next.js (`GET /api/evaluations/[id]/report`) returns a short-lived signed URL for the PDF in Storage.

### Pro upgrade flow (demo)

When a free user hits the upload limit:

1. A modal offers **Free** vs **Pro**.
2. **Upgrade to Pro** → `/checkout` (dummy payment page).
3. **Checkout** → `POST /api/billing/upgrade` sets `plan: pro` via service role.
4. User returns to the dashboard and can upload without the monthly cap.

---

## Project structure

```
EvalAI/
├── frontend/                 # Next.js app (deploy to Vercel)
│   ├── app/
│   │   ├── api/evaluations/  # Create & list evaluation jobs
│   │   ├── api/billing/      # Pro upgrade (dummy checkout)
│   │   ├── checkout/         # Dummy payment page
│   │   ├── dashboard/        # Upload UI + evaluation list
│   │   └── auth/callback/    # Supabase OAuth / email callback
│   └── components/dashboard/
├── worker/                   # Python background worker (deploy separately)
│   ├── worker/
│   │   ├── main.py           # Poll loop
│   │   ├── processor.py      # Job pipeline
│   │   ├── parser.py         # User/Agent turn parsing
│   │   ├── analytics.py      # Token counts + model fit
│   │   ├── model_catalog.py  # Supabase catalog loader + JSON fallback
│   │   ├── app_settings.py   # Supabase settings loader + env fallback
│   │   ├── charts.py         # matplotlib charts
│   │   └── pdf_report.py     # PDF generation
│   ├── Dockerfile            # Optional container deploy
│   └── requirements.txt
└── supabase/
    ├── schema.sql            # Tables, RLS, storage buckets
    ├── migration_worker.sql  # Job claim RPC, usage limits, Realtime
    ├── migration_model_catalog.sql  # model_catalog table + seed data
    ├── migration_app_settings.sql   # app_settings key-value defaults
    └── migration_user_reported_model.sql  # optional model on upload
```

---

## Database & storage (Supabase)

### Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User plan (`free` / `pro`), subscription fields |
| `evaluations` | Job queue + results (`pending` → `processing` → `completed` / `failed`) |
| `usage_counters` | Monthly upload count per user (free tier) |
| `model_catalog` | LLM pricing/context for worker cost & fit analysis (editable without redeploy) |
| `app_settings` | Global worker knobs (default reference model, reserved tokens, cache TTL) |

### Storage buckets

| Bucket | Who writes | Who reads |
|--------|------------|-----------|
| `transcripts` | User (browser) | Worker |
| `reports` | Worker (service role) | User |

Path format: `{user_id}/{evaluation_id}/filename`

---

## Local development

### Prerequisites

- Node.js 20+
- Python 3.11+
- A Supabase project

### 1. Supabase setup

In **Supabase Dashboard → SQL Editor**, run in order:

1. `supabase/schema.sql`
2. `supabase/migration_worker.sql`
3. `supabase/migration_model_catalog.sql`
4. `supabase/migration_app_settings.sql`
5. `supabase/migration_user_reported_model.sql`

Confirm **Realtime** is enabled for `evaluations` (included in migration).

To update model prices in production, edit rows in `model_catalog` (SQL Editor or Table Editor). To change global defaults (reference model, reserved tokens, cache TTL), edit `app_settings`. The worker reloads from Supabase every 15 minutes by default (`model_catalog_cache_seconds`).

**Auth → URL configuration:**

- Site URL: `http://localhost:3000`
- Redirect URLs: `http://localhost:3000/**`

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
# and SUPABASE_SERVICE_ROLE_KEY (server-only; from Supabase → Settings → API)

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 3. Worker

```bash
cd worker
cp .env.example .env
# Fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m worker.main
```

You should see: `Worker started (poll=3s, max_concurrent=2)`.

### 4. Test

1. Sign up / sign in.
2. Upload `worker/sample_transcript.txt` or `worker/sample_transcript.md`.
3. Watch status change to **Completed**.
4. Download the PDF.

---

## Environment variables

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Anon / publishable key (browser-safe) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (API routes only — never expose to client) |

### Worker (`worker/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `SUPABASE_URL` | — | Same as project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Service role key |
| `POLL_INTERVAL_SECONDS` | `3` | How often to check for new jobs |
| `MAX_CONCURRENT_JOBS` | `2` | Parallel jobs per worker process |
| `RESERVED_OUTPUT_TOKENS` | `4096` | Reserved for model fit calculations |

---

## Deployment

| Part | Platform | Notes |
|------|----------|-------|
| **Frontend** | [Vercel](https://vercel.com) | Root directory: `frontend` |
| **Worker** | [Railway](https://railway.app) or [Render](https://render.com) | Root directory: `worker`; plain Python or Docker |
| **Database / Auth / Storage** | Supabase | Run SQL migrations; set production auth redirect URLs |

**Do not deploy the worker on Vercel** — it needs a long-running process.

After deploying the frontend, add your Vercel URL to Supabase **Auth → Redirect URLs**.

Worker deploy options:

- **Plain Python:** start command `python -m worker.main`
- **Docker:** `docker build -t evalai-worker .` then `docker run --env-file .env evalai-worker`

See `worker/README.md` for worker-specific details.

---

## Worker modules

| Module | Responsibility |
|--------|----------------|
| `main.py` | Infinite poll loop, thread pool, stale-job recovery |
| `processor.py` | Download transcript, orchestrate pipeline, upload PDF |
| `parser.py` | Split transcripts into user/agent turns |
| `analytics.py` | Token counts, model ranking, cost analysis orchestration |
| `user_evaluation.py` | Twelve-skill heuristic scoring (incl. redundancy detection) |
| `prompting_coach.py` | Hybrid coach: rules → similarity → optional LLM enrichment |
| `similarity.py` | All-pairs lexical/semantic redundancy detection |
| `openrouter_client.py` | OpenRouter API client for optional LLM/embeddings |
| `llm_coach.py` | Optional structured turn coaching via OpenRouter (feature-flagged) |
| `charts.py` | Bar, pie, and Nightingale (rose) charts |
| `pdf_report.py` | **AI Tool usage analyzer** PDF with readable tables and charts |

---

## Plans

| Feature | Free | Pro |
|---------|------|-----|
| Uploads per month | 5 | Unlimited |
| Token PDF reports | Yes | Yes |
| API access | No | Yes (planned) |
| Upgrade | — | Dummy checkout (`/checkout`) |

---

## Troubleshooting

| Issue | Likely cause |
|-------|----------------|
| Jobs stay **Queued** | Worker not running or wrong `SUPABASE_SERVICE_ROLE_KEY` |
| `Invalid API key` (worker) | Placeholder values in `worker/.env` or using anon key instead of service role |
| Upload fails immediately | Missing `SUPABASE_SERVICE_ROLE_KEY` in `frontend/.env.local` |
| Sign-in fails in production | Vercel URL not in Supabase redirect URLs |
| Realtime error on dashboard | Fixed channel reuse — ensure latest `EvaluationsList` is deployed |
| Worker claims job but never completes | File not uploaded yet; worker resets to `pending` and retries |

---

## License

Private / project use — add a license if you open-source this repo.

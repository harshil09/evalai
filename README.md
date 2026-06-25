# EvalAI

Upload chat transcripts between a **user** and an **agent**, get deterministic **token analysis** (no LLM required), and download a **PDF report** with statistics, charts, and prompting insights.

Built with **Next.js**, **Supabase**, and a **Python background worker**.

---

## What it does

1. **Sign up / sign in** via Supabase Auth (`/signin`, `/signup`). The home page redirects to sign-in.
2. **Upload** one or more `.txt` or `.md` transcripts on the dashboard (classic `User:` / `Agent:` labels or **Cursor markdown** exports with `**User**` / `**Cursor**` blocks).
3. **Track** evaluations on the **History** tab: Queued → Processing → Completed (Supabase Realtime + polling).
4. **Download** transcript files and PDF reports per evaluation, or export everything as a **ZIP backup**.
5. **Delete** evaluations from History (removes DB row and Storage files).
6. **Free vs Pro plans:**
   - **Free:** 5 uploads per calendar month
   - **Pro:** Unlimited uploads (dummy checkout flow for demo)

### PDF report contents

- Total tokens and per-role breakdown (user vs agent)
- Tokens per turn (bar chart), token share by role (pie chart), and Nightingale (rose) chart
- Model fit table (which models fit in context window + estimated input cost)
- **Prompting analysis:** twelve-skill heuristic scoring, redundancy detection, and optional LLM coaching on flagged turns
- **Prompt efficiency** score and grade (shown in History when completed)

Analysis is **rule-based** using [tiktoken](https://github.com/openai/tiktoken). Optional **LLM coaching** (`ENABLE_LLM_COACH=true` on the worker, or `enable_llm_coach` in `app_settings`) enriches flagged turns only — it never blocks job completion.

Set `OPENROUTER_API_KEY` in `worker/.env` when enabling the hybrid LLM coach stage (uses [OpenRouter](https://openrouter.ai/) with OpenAI-compatible models).

---

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   Browser   │────▶│  Next.js (Vercel) │────▶│      Supabase       │
│  Dashboard  │     │  API routes       │     │  Postgres + Storage │
└──────┬──────┘     └──────────────────┘     └──────────┬──────────┘
       │                                                  │
       │  direct upload (transcripts bucket)              │ poll & claim jobs
       └─────────────────────────────────────────────────▶│
                                                          │
                                               ┌──────────▼──────────┐
                                               │   Python worker(s)  │
                                               │  Docker Compose or  │
                                               │  Railway / Render   │
                                               └─────────────────────┘
```

| Component | Technology | Role |
|-----------|------------|------|
| **Frontend + API** | Next.js 16, React 19, Tailwind | UI, auth, create jobs, billing, signed URLs, ZIP backup |
| **Backend data** | Supabase | Auth, Postgres (job queue), Storage, Realtime |
| **Worker** | Python 3.12 | Parse transcripts, count tokens, generate PDF |

The worker does **not** talk to Next.js. **Supabase** is the shared layer: Postgres is the job queue, Storage holds transcripts and reports.

---

## Dashboard

The dashboard (`/dashboard`) has three tabs (also addressable via `?tab=upload`, `?tab=history`, `?tab=backup`):

| Tab | Purpose |
|-----|---------|
| **Upload Transcript** | Multi-file upload (`.txt`, `.md`); drag-and-drop or file picker |
| **History** | Last 7 days of evaluations; download transcript/PDF; delete; paginated (5 per page, Load more) |
| **Backup** | Download a ZIP of all your transcripts and completed PDF reports (`GET /api/backup`, uses [jszip](https://www.npmjs.com/package/jszip)) |

The **Account** card shows name, email, plan, and monthly upload usage (Pro shows “Unlimited uploads”).

---

## How it works

### Auth flow

1. User visits `/` → redirected to `/signin`.
2. Sign-up collects first name, last name, email, and password (stored in `profiles` via trigger).
3. `frontend/proxy.ts` refreshes the Supabase session from cookies and protects `/dashboard` routes.

### Upload flow

1. User selects one or more files and clicks **Upload & analyze**.
2. **Next.js** (`POST /api/evaluations`) calls Supabase RPC `create_evaluation_job`:
   - Enforces free-tier limit (5/month) or allows Pro unlimited
   - Optionally validates `user_reported_model` against `model_catalog`
   - Inserts an `evaluations` row with `status: pending`
   - Sets `transcript_path` to `{user_id}/{evaluation_id}/{filename}`
3. **Browser** uploads each file directly to Supabase Storage (`transcripts` bucket).
4. On success, the dashboard switches to the **History** tab.

### Worker flow

The worker is a **long-running process** that **polls** the database every few seconds (it is not notified when a file lands in Storage).

1. Calls RPC `claim_evaluation(p_worker_format_version)` — atomically picks the oldest `pending` row and sets `status: processing` (`FOR UPDATE SKIP LOCKED` for safe multi-worker scaling). Workers must declare `REPORT_FORMAT_VERSION` (currently **2**); older workers stop receiving jobs after `migration_worker_format_version.sql`.
2. Checks whether the transcript file exists in Storage (if the user is still uploading, sets status back to `pending` and retries later).
3. Downloads the transcript, parses user/agent turns (including Cursor markdown exports).
4. Counts tokens with tiktoken, loads model catalog and app settings from Supabase, runs prompting analysis.
5. Builds charts (matplotlib) and a PDF (ReportLab) titled **AI Tool usage analyzer**.
6. Uploads PDF to the `reports` bucket.
7. Updates the row: `status: completed`, `report_path`, `evaluation_summary` (JSON), `completed_at`.

Stale jobs stuck in `processing` for 30+ minutes are recovered via `recover_stale_evaluations`.

### Download flow

1. **History** listens for row changes via **Supabase Realtime** and polls while jobs are active.
2. User clicks **Transcript** or **PDF report**.
3. Next.js returns a short-lived signed URL:
   - `GET /api/evaluations/[id]/transcript`
   - `GET /api/evaluations/[id]/report`

### Delete flow

1. User clicks **Delete** on a History row.
2. `DELETE /api/evaluations/[id]` removes transcript and report from Storage, then deletes the evaluation row.

### Backup flow

1. User opens the **Backup** tab and clicks download.
2. `GET /api/backup` builds a ZIP server-side: `transcripts/` and `reports/` folders for all evaluations (all time, not limited to 7 days).

### Pro upgrade flow (demo)

When a free user hits the upload limit:

1. A modal offers **Free** vs **Pro**.
2. **Upgrade to Pro** → `/checkout` (dummy payment page).
3. **Checkout** → `POST /api/billing/upgrade` sets `plan: pro` via service role.
4. User returns to the dashboard and can upload without the monthly cap.

---

## API routes

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/evaluations` | Create evaluation job(s) |
| `GET` | `/api/evaluations` | List user's evaluations (last 7 days) |
| `DELETE` | `/api/evaluations/[id]` | Delete evaluation + Storage files |
| `GET` | `/api/evaluations/[id]/transcript` | Signed URL for transcript |
| `GET` | `/api/evaluations/[id]/report` | Signed URL for PDF report |
| `GET` | `/api/backup` | ZIP backup of all transcripts and reports |
| `GET` | `/api/models` | Active models from `model_catalog` |
| `POST` | `/api/billing/upgrade` | Set user plan to Pro (demo) |

---

## Project structure

```
EvalAI/
├── docker-compose.yml        # 5 worker containers (repo root)
├── frontend/                 # Next.js app (deploy to Vercel)
│   ├── app/
│   │   ├── api/
│   │   │   ├── backup/           # ZIP export (jszip)
│   │   │   ├── billing/upgrade/  # Pro upgrade
│   │   │   ├── evaluations/      # CRUD + signed URLs
│   │   │   └── models/           # Model catalog for UI
│   │   ├── auth/callback/        # Supabase OAuth / email callback
│   │   ├── checkout/             # Dummy payment page
│   │   ├── dashboard/            # Main app UI
│   │   ├── signin/               # Sign in
│   │   └── signup/               # Sign up
│   ├── components/
│   │   ├── auth/                 # AuthShell, AuthForm
│   │   └── dashboard/            # Tabs, upload, history, backup
│   ├── proxy.ts                  # Session refresh + route protection
│   └── utils/supabase/           # Browser, server, admin clients
├── worker/                   # Python background worker
│   ├── worker/
│   │   ├── main.py           # Poll loop, thread pool, stale recovery
│   │   ├── processor.py      # Job pipeline
│   │   ├── parser.py         # User/Agent + Cursor markdown parsing
│   │   ├── analytics.py      # Token counts + model fit
│   │   ├── user_evaluation.py    # Twelve-skill heuristic scoring
│   │   ├── prompting_coach.py    # Rules → similarity → optional LLM
│   │   ├── similarity.py         # Redundancy detection
│   │   ├── llm_coach.py          # OpenRouter turn coaching
│   │   ├── openrouter_client.py
│   │   ├── model_catalog.py  # Supabase catalog + JSON fallback
│   │   ├── app_settings.py   # Supabase settings + env fallback
│   │   ├── charts.py         # matplotlib charts
│   │   ├── pdf_report.py     # PDF generation
│   │   └── version.py        # REPORT_FORMAT_VERSION
│   ├── scripts/
│   │   └── requeue_legacy_reports.py
│   ├── Dockerfile
│   └── requirements.txt
└── supabase/
    ├── schema.sql
    ├── migration_worker.sql
    ├── migration_worker_format_version.sql
    ├── migration_model_catalog.sql
    ├── migration_app_settings.sql
    ├── migration_user_reported_model.sql
    ├── migration_llm_coach_settings.sql
    └── migration_profile_names.sql
```

---

## Database & storage (Supabase)

### Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User name, email, plan (`free` / `pro`), subscription fields |
| `evaluations` | Job queue + results (`pending` → `processing` → `completed` / `failed`) |
| `usage_counters` | Monthly upload count per user (free tier) |
| `model_catalog` | LLM pricing/context for worker cost & fit analysis (editable without redeploy) |
| `app_settings` | Global worker knobs (reference model, reserved tokens, cache TTL, LLM coach flags) |

### Storage buckets

| Bucket | Who writes | Who reads |
|--------|------------|-----------|
| `transcripts` | User (browser) | Worker, user (signed URL) |
| `reports` | Worker (service role) | User (signed URL) |

Path format: `{user_id}/{evaluation_id}/filename`

### RPC functions

| Function | Used by |
|----------|---------|
| `create_evaluation_job` | Next.js API (service role) |
| `claim_evaluation` | Worker (service role) |
| `recover_stale_evaluations` | Worker (service role) |

---

## Local development

### Prerequisites

- Node.js 20+
- Python 3.11+
- A Supabase project
- Docker (optional, for worker pool)

### 1. Supabase setup

In **Supabase Dashboard → SQL Editor**, run in order:

1. `supabase/schema.sql`
2. `supabase/migration_worker.sql`
3. `supabase/migration_worker_format_version.sql`
4. `supabase/migration_model_catalog.sql`
5. `supabase/migration_app_settings.sql`
6. `supabase/migration_user_reported_model.sql`
7. `supabase/migration_llm_coach_settings.sql`
8. `supabase/migration_profile_names.sql` (if `profiles` already exists without name columns)

Confirm **Realtime** is enabled for `evaluations` (included in `migration_worker.sql`).

To update model prices in production, edit rows in `model_catalog`. To change global defaults (reference model, reserved tokens, cache TTL, LLM coach), edit `app_settings`. The worker reloads from Supabase every 15 minutes by default (`MODEL_CATALOG_CACHE_SECONDS`).

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

Open [http://localhost:3000](http://localhost:3000) (redirects to sign-in).

### 3. Worker (single process)

```bash
cd worker
cp .env.example .env
# Fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m worker.main
```

You should see: `Worker started (poll=3s, max_concurrent=2, report='AI Tool usage analyzer', format_version=2, ...)`.

Only **one** local worker process can run at a time (file lock in `worker/.worker.lock`). Stop it before starting Docker workers.

### 3b. Worker pool (Docker Compose)

For batch uploads (e.g. many transcripts at once), run **5 worker containers** from the **repo root**. Each container processes up to **2 jobs in parallel** (`MAX_CONCURRENT_JOBS=2`), so up to **10 evaluations at once**.

```bash
# From repo root — ensure worker/.env exists (see step 3)
docker compose build
docker compose up -d
docker compose ps          # evalai-worker-1 … evalai-worker-5
docker compose logs -f     # tail all worker logs
docker compose down        # stop the pool
```

Do **not** run `python -m worker.main` and Docker workers at the same time — they compete on the same queue.

### 4. Test

1. Sign up / sign in.
2. Upload `worker/sample_transcript.txt` or `worker/sample_transcript.md` (or a Cursor export `.md`).
3. Open **History** and watch status change to **Completed**.
4. Download the PDF or use **Backup** to export a ZIP.

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
| `MODEL_CATALOG_CACHE_SECONDS` | `900` | How long to cache Supabase catalog/settings |
| `DEFAULT_REFERENCE_MODEL` | `gpt-4o` | Fallback reference model |
| `ENABLE_LLM_COACH` | off | Enable OpenRouter coaching (overrides `app_settings` when set) |
| `OPENROUTER_API_KEY` | — | Required when LLM coach is enabled |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | OpenRouter API base |
| `LLM_COACH_MODEL` | `openai/gpt-4o-mini` | Chat model for coaching |
| `EMBEDDING_MODEL` | `openai/text-embedding-3-small` | Embeddings for similarity stage |

Docker Compose also sets `MAX_CONCURRENT_JOBS` and `POLL_INTERVAL_SECONDS` per container (see `docker-compose.yml`).

---

## Deployment

| Part | Platform | Notes |
|------|----------|-------|
| **Frontend** | [Vercel](https://vercel.com) | Root directory: `frontend` |
| **Worker** | [Railway](https://railway.app), [Render](https://render.com), or **Docker Compose** | Root: `worker`; or `docker compose up` from repo root |
| **Database / Auth / Storage** | Supabase | Run all SQL migrations; set production auth redirect URLs |

**Do not deploy the worker on Vercel** — it needs a long-running process.

After deploying the frontend, add your production URL to Supabase **Auth → Redirect URLs**.

Worker deploy options:

- **Plain Python:** start command `python -m worker.main`
- **Docker:** `docker build -t evalai-worker ./worker` then `docker run --env-file worker/.env evalai-worker`
- **Compose pool:** `docker compose up -d` from repo root (5 replicas)

After deploying a new worker build, run `migration_worker_format_version.sql` if you bump `REPORT_FORMAT_VERSION` in `worker/worker/version.py`.

---

## Worker modules

| Module | Responsibility |
|--------|----------------|
| `main.py` | Infinite poll loop, thread pool, process lock, stale-job recovery |
| `processor.py` | Download transcript, orchestrate pipeline, upload PDF |
| `parser.py` | Split transcripts into user/agent turns (classic + Cursor markdown) |
| `analytics.py` | Token counts, model ranking, cost analysis orchestration |
| `user_evaluation.py` | Twelve-skill heuristic scoring (incl. redundancy detection) |
| `prompting_coach.py` | Hybrid coach: rules → similarity → optional LLM enrichment |
| `similarity.py` | All-pairs lexical/semantic redundancy detection |
| `openrouter_client.py` | OpenRouter API client for optional LLM/embeddings |
| `llm_coach.py` | Optional structured turn coaching via OpenRouter (feature-flagged) |
| `cost_analysis.py` | Cost formatting and comparison helpers |
| `charts.py` | Bar, pie, and Nightingale (rose) charts |
| `pdf_report.py` | **AI Tool usage analyzer** PDF with readable tables and charts |
| `version.py` | `REPORT_FORMAT_VERSION` — bump when PDF layout changes |

---

## Plans

| Feature | Free | Pro |
|---------|------|-----|
| Uploads per month | 5 | Unlimited |
| Token PDF reports | Yes | Yes |
| History & backup | Yes | Yes |
| Upgrade | — | Dummy checkout (`/checkout`) |

---

## Troubleshooting

| Issue | Likely cause |
|-------|----------------|
| Jobs stay **Queued** | Worker not running or wrong `SUPABASE_SERVICE_ROLE_KEY` |
| `Invalid API key` (worker) | Placeholder values in `worker/.env` or using anon key instead of service role |
| Upload fails immediately | Missing `SUPABASE_SERVICE_ROLE_KEY` in `frontend/.env.local` |
| Sign-in fails in production | Production URL not in Supabase redirect URLs |
| Checkout returns **Unauthorized** | Session cookie not visible to API — ensure latest auth/proxy code is deployed |
| History not updating | Realtime subscription or polling — refresh page; check Supabase Realtime is enabled |
| Worker claims job but never completes | File not uploaded yet; worker resets to `pending` and retries |
| `Another EvalAI worker is already running` | Second local `python -m worker.main` — stop duplicate or use Docker only |
| Old PDF format after deploy | Bump `REPORT_FORMAT_VERSION` and run `migration_worker_format_version.sql`; restart all workers |
| Cursor export fails parsing | Ensure latest worker code (markdown `**User**` / `**Cursor**` split) is running |

---

## Authors

**Harshil Soni** ([@harshil09](https://github.com/harshil09)) — [harshilsoni757@gmail.com](mailto:harshilsoni757@gmail.com)

**Nirali Soni** ([@Nirali06](https://github.com/Nirali06)) — [niralisoni0606@gmail.com](mailto:niralisoni0606@gmail.com)

---

## License

Private / project use — add a license if you open-source this repo.

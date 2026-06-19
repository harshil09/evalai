# TranscriptIQ — Frontend

Next.js app for the TranscriptIQ (EvalAI) project. See the **[root README](../README.md)** for full architecture, worker flow, and deployment.

## Quick start

```bash
cp .env.example .env.local
# Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
# and SUPABASE_SERVICE_ROLE_KEY

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The **Python worker** must also be running for uploads to complete — see [worker/README.md](../worker/README.md).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Run production build locally |
| `npm run lint` | ESLint |

## Deploy

Deploy to **Vercel** with root directory set to `frontend`. See [root README — Deployment](../README.md#deployment).

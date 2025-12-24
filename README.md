# Tailr-AI (Hugo + Cloudflare Pages Functions)

Tailr-AI is a Hugo site served on Cloudflare Pages with backend API routes powered by
Cloudflare Pages Functions calling Groq LLMs.

## Tech Stack
- **Frontend**: Hugo (layouts + inline JS)
- **Backend**: Cloudflare Pages Functions (`/functions/api/...`)
- **LLM**: Groq `llama-3.3-70b-versatile`

## API Routes (Same-Origin)
All routes are prefixed with `/api`:

- `POST /api/master/add-job`
- `POST /api/master/generate-ai`
- `POST /api/master/summary`
- `POST /api/master/export-word`
- `POST /api/tailor/analyze`
- `POST /api/tailor/export-word`
- `POST /api/ats/scan`
- `POST /api/match/score`

## Required Environment Variables
- `GROQ_API_KEY`: Groq API key (required in production)
- `DEBUG`: `true`/`false` to enable server-side debug logging

## Local Development

### 1) Build the Hugo site
```bash
hugo
```

This outputs the static site to `public/`.

### 2) Run Cloudflare Pages (with Functions)
```bash
npx wrangler pages dev public \
  --compatibility-date=2024-04-01 \
  --binding GROQ_API_KEY=your_key_here \
  --binding DEBUG=true
```

Open the local URL printed by Wrangler and navigate to `/tailr-ai/`.

### 3) Test an API route
```bash
curl -X POST http://localhost:8788/api/master/add-job \
  -H "Content-Type: application/json" \
  -d '{"role":"Analyst","dates":"2022-2024"}'
```

## Production Notes
- Configure Cloudflare Pages env vars for `GROQ_API_KEY` and optional `DEBUG`.
- Functions are served from `/api/*` and are same-origin with the site.

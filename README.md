# Ghost Night Stories

Horror storytelling platform. **Frontend:** React + TypeScript (Vite). **Backend:** Go (standard library only, no dependencies). **Data:** JSON file store, with a PostgreSQL schema included for upgrading.

```
ghost-night-stories/
├── preview/index.html      Standalone clickable preview (open in any browser, no install)
├── frontend/               React + TypeScript app
│   ├── public/             icon.png (app icon), seed.json (offline fallback content)
│   └── src/                pages/, components/ (Jumpscare, Narrator), api.ts, auth.tsx
├── backend/                Go API
│   ├── main.go             server, CORS, rate limiting, security headers
│   ├── auth.go             PBKDF2 password hashing, signed tokens
│   ├── store.go            data models, persistence, seed loading
│   ├── handlers.go         public, user and admin endpoints
│   ├── admin.go            story editor endpoints, cover image upload
│   ├── videos.go           jumpscare video URL validation and manager
│   ├── seed.json           8 stories, 3 interactive stories, 5 mysteries, 3 archive cases
│   ├── db/schema.sql       PostgreSQL schema (not yet wired in)
│   └── Dockerfile
└── .env.example
```

**Quick start: see the "Run locally" steps below. Going live? Follow `GO_LIVE.md`.**

## Run locally
Needs Go 1.22+ and Node 18+.

```bash
# 1) backend
cd backend
cp .env.example .env            # then edit values; export them (see below)
export $(grep -v '^#' .env | xargs)
go run .                        # http://localhost:8080

# 2) frontend (new terminal)
cd frontend
npm install
npm run dev                     # http://localhost:5173  (proxies /api to :8080)
```
`JWT_SECRET` (32+ chars) is required. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` to create the admin account on first start, then sign in on the site and open **Admin**.

## Credentials you need
| What | Where | Needed for |
|---|---|---|
| `JWT_SECRET` | backend env | sign-in tokens (required) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | backend env | the admin account |
| `VITE_API_URL` | frontend env | URL of the deployed backend, e.g. `https://api.example.com/api` |


## Deploy
- **Frontend (Vercel):** import the repo, set Root Directory to `frontend`, add `VITE_API_URL`. `vercel.json` handles routing.
- **Backend (Render, Railway or Fly.io):** deploy `backend/` with its Dockerfile. Set the env vars above, set `CORS_ORIGIN` to your frontend URL, and attach a **persistent disk** mounted at `/data` (the data file lives at `/data/data.json`). Vercel cannot host this Go server with persistent data.
- Never commit `.env`. `.gitignore` already excludes it.

## Jumpscare videos
Admin → Jumpscare video manager. Add an `https` URL ending in `.mp4` or `.webm`. The server checks that the host resolves to a public address and reports a `video/*` content type. Broken videos are flagged and skipped. In the reader, if a video fails to start in 3.5 s or errors, the next one is tried, then a built-in flash. The overlay always closes by itself, and the reader returns to the exact scroll position. The first scare never fires within 25 s of opening a story. Use only footage you own or have written permission to use. Many hosts block hotlinking or embedding, so test each URL.

## Included and not included
Everything is written by people: you in Admin, and the community through Submit (moderated). There is no AI story generator.

Included: story library with search, filter, sort and pagination; reader with bookmarks and saved progress; jumpscare engine (random timer, scroll triggers, per-level timing, mute, full-screen toggle, warning); narration (browser text-to-speech, speed, volume, skip, progress) with synthesized wind and knocking; 3 interactive stories with several endings; daily mystery with reader theories and next-day reveal; classified archive; community submissions with moderation, honeypot, rate limits and reporting; accounts; admin dashboard.

Also included: admin story editor (create and edit stories, upload covers, trigger points, preview).

Not included yet (planned next): password recovery email, audio file uploads, category manager, chapter-based jumpscare triggers, PostgreSQL wiring, 15+ seed stories (8 sample stories ship; edit or replace them in Admin), whispers and footsteps audio (needs licensed audio files).

## Testing status
The code in this zip was **not compiled or run** in the environment it was written in (no Go toolchain or npm network access there). Expect to fix a few small compile or type errors on first run. `preview/index.html` was syntax-checked.

# Go live: step by step

You need three free accounts: GitHub, Render (backend) and Vercel (frontend). A computer makes this much easier than a phone.

## 0. Check it locally first (recommended)
Follow "Run locally" in README.md. If something fails to compile, fix it here before deploying.

## 1. Put the code on GitHub
1. Unzip `ghost-night-stories.zip`.
2. On github.com click New repository, name it `ghost-night-stories`, set it to **Private**, and create it.
3. Click "uploading an existing file", drag in the unzipped **contents** (the `backend`, `frontend`, `preview` folders and the files next to them), and commit.
4. Make sure no `.env` file is uploaded. Secrets go in Render and Vercel settings, never in GitHub.

## 2. Backend on Render
1. render.com: New, Web Service, connect the GitHub repo.
2. Root Directory: `backend`. Runtime: **Docker**.
3. Instance type: pick a paid one. Free instances have no persistent disk, so your stories, accounts and uploaded covers would be wiped on every restart. Check Render's current pricing.
4. Add a **Disk**: mount path `/data`, size 1 GB.
5. Environment variables:
   - `JWT_SECRET` = a random string of 32+ characters
   - `ADMIN_EMAIL` and `ADMIN_PASSWORD` = your admin login (use a long password)
   - `CORS_ORIGIN` = `https://temporary.example` for now (you fix it in step 4)
6. Set Health Check Path to `/api/health`, then deploy.
7. When it says Live, open `https://YOUR-SERVICE.onrender.com/api/health`. You should see `{"status":"ok"}`. Copy the base URL.

If the build fails, open the build log and send me the error text.

## 3. Frontend on Vercel
1. vercel.com: Add New, Project, import the same repo.
2. Root Directory: `frontend`. Framework: Vite.
3. Environment variable: `VITE_API_URL` = `https://YOUR-SERVICE.onrender.com/api`
4. Deploy. Copy your site URL, for example `https://ghost-night-stories.vercel.app`.

## 4. Connect them
Back in Render, change `CORS_ORIGIN` to your exact Vercel URL (no trailing slash), then redeploy. Without this the site loads but sign-in and admin fail.

## 5. First-run checklist
1. Open your Vercel URL. Stories and covers should show.
2. Click Sign in and use `ADMIN_EMAIL` and `ADMIN_PASSWORD`. An Admin button appears.
3. Admin, All stories, Edit a story, upload a cover, Save and publish. Open it on your phone.
4. Submit a test story from the Submit page, then approve it in the moderation queue.
5. Add a jumpscare video URL you have permission to use, check it shows Playable, then test a scare in the reader.
6. Register a normal account on another device and confirm it cannot open /admin.

## 6. Afterwards
- Custom domain: add it in Vercel (frontend) and update `CORS_ORIGIN` in Render to match.
- Back up `/data/data.json` and `/data/uploads` regularly (Render disk snapshots or download copies).
- Never commit `.env`. Change `ADMIN_PASSWORD` in Render if it ever leaks.
- Only use videos, images and music you own or have permission to use.

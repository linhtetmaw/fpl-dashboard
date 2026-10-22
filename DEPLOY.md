# Deploy FPL Dashboard to Railway

Step-by-step guide to deploy the FPL House dashboard (React + Express) on [Railway](https://railway.app).

---

## Prerequisites

- A [Railway](https://railway.app) account (free tier is fine).
- Your project in a Git repo (GitHub, GitLab, or Bitbucket).

---

## Step 1: Push your code to GitHub

If you haven’t already:

```bash
cd fpl-dashboard
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/fpl-dashboard.git
git push -u origin main
```

---

## Step 2: Create a new project on Railway

1. Go to [railway.app](https://railway.app) and log in.
2. Click **“New Project”**.
3. Choose **“Deploy from GitHub repo”**.
4. Select your **fpl-dashboard** repository (and authorize Railway if asked).
5. Railway will add the repo; you’ll configure the service next.

---

## Step 3: Configure the service (build & start)

Railway will detect the repo and create one service. Set the build and start commands:

1. Open your project → click the service (e.g. “fpl-dashboard”).
2. Go to the **Settings** tab (or **Variables**).
3. Under **Build** (or in **Settings**):
   - **Build Command:**  
     `npm run build`
   - This runs the root script: installs server + client deps and builds the React app into `client/dist`.

4. Under **Start** (or **Deploy**):
   - **Start Command:**  
     `npm start`
   - This runs `node server/index.js` from the repo root. The server serves the built app from `client/dist` and handles `/api`.

5. **Root directory:** leave as **empty** (repo root). Railway runs commands from the repo root.

6. **Watch Paths (optional):** leave default so pushes to `main` trigger a new deploy.

---

## Step 4: Root `package.json` scripts (already set)

The repo root already has:

- **Build:** `npm run build` — installs dependencies and builds the client.
- **Start:** `npm start` — runs `node server/index.js`; the server serves `client/dist` when present.

In Railway use:

- **Build Command:** `npm run build`
- **Start Command:** `npm start`

---

## Smoke test (runs before every push)

`scripts/smoke-test.sh` builds what's committed, removes everything Railway's runtime container doesn't have (only `server/` and `client/dist` stay), starts the server and checks the key pages. It runs:

- **Before each push** via `.githooks/pre-push` — a failure stops the push. On a new clone, enable it once with `git config core.hooksPath .githooks`. Skip once (emergencies only) with `git push --no-verify`.
- **On GitHub** for every push/PR to `main` (`.github/workflows/smoke-test.yml`). In Railway → service → **Settings → Source**, turn on **Wait for CI** so a failed check stops the deploy.

Run it by hand any time: `bash scripts/smoke-test.sh` (or `bash scripts/smoke-test.sh <commit>` to test a specific commit).

## Go-live checklist (custom domain)

1. **Railway → Settings → Networking → Custom Domain:** add your domain (e.g. `fplhouse.com`, and `www.fplhouse.com` if you want it) and create the DNS records Railway shows you at your domain registrar. Railway issues the HTTPS certificate automatically.
2. **Variables** (Railway → Variables):
   - `CANONICAL_HOST=fplhouse.com` – sends the `*.up.railway.app` address and `www.` to your main domain (needed for Telegram login, and better for Google).
   - `SESSION_SECRET` – long random string (`openssl rand -hex 32`).
   - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` – see "Telegram login setup".
   - `DATA_DIR=/data` with a **Volume** mounted at `/data` – keeps saved squads across deploys.
   - `ADMIN_TOKEN` (optional) – only needed to call `POST /api/search/reload` (send it as the `X-Admin-Token` header).
3. **@BotFather → /setdomain:** set it to the same domain as `CANONICAL_HOST`.
4. **Google Analytics:** add the new domain to your GA4 web stream if it isn't there.
5. **After deploy:** open `https://<your-domain>/api/health` (should show `"ok": true`), log in with Telegram on Squad Planner, save a squad, then redeploy once and check the squad is still there.

## Step 5: Environment variables (optional)

- **PORT:** Railway sets `PORT` automatically; the server already uses `process.env.PORT || 3001`.
- No API keys are required for the FPL proxy or TheSportsDB (free key is used in code).
- **DATA_DIR** (needed for Squad Planner): saved squads are written to `squads.json` in this folder (default `server/data/`). Railway's filesystem is wiped on every redeploy, so add a Railway **Volume** (e.g. mounted at `/data`) and set `DATA_DIR=/data` — otherwise everyone's saved squads are lost on each deploy.
- **TELEGRAM_BOT_TOKEN** and **TELEGRAM_BOT_USERNAME** (needed to save Squad Planner squads): users log in with Telegram, up to 3 squads each. See "Telegram login setup" below. Never commit the token.
- **SESSION_SECRET**: a long random string (e.g. from `openssl rand -hex 32`) used to sign login cookies. If it's missing, everyone is logged out whenever the server restarts.

### Monitoring the FPL cache

All FPL API calls go through an in-memory cache (`server/fpl-api.js`), so traffic to FPL stays roughly flat as visitors grow. Open `https://<your-domain>/api/health` to see it working: `hits` should be far above `upstream` (requests actually sent to FPL), and a rising `stale` or `errors` count means FPL is failing or rate-limiting us. Point a free uptime monitor (e.g. UptimeRobot) at this URL.

### Telegram login setup (Squad Planner)

1. In Telegram, open **@BotFather** → `/newbot` → pick a name and a username (e.g. `FPLHouseLoginBot`). Copy the token it gives you.
2. Still in @BotFather: `/setdomain` → choose the bot → send your site's domain (e.g. `fplhouse.com`, no `https://`). The login button only works on this domain, so it won't appear on `localhost`.
3. In Railway, set `TELEGRAM_BOT_TOKEN` (the token), `TELEGRAM_BOT_USERNAME` (the username without `@`) and `SESSION_SECRET`, then redeploy.
4. Open Squad Planner: the "Log in with Telegram" button appears in the account bar. Users can still build a squad without logging in; logging in is only needed to save.

You can add env vars in Railway: **Project → Variables** or **Service → Variables**.

---

## Step 6: Deploy

1. Save the build/start settings.
2. Railway will run the **build** (install + `npm run build`), then **start** (`npm start`).
3. Check the **Deployments** tab for logs. The first deploy may take a few minutes.

---

## Step 7: Get the public URL

1. In your service, open the **Settings** tab.
2. Under **Networking** or **Public Networking**, click **Generate Domain** (or use the default).
3. Copy the URL (e.g. `https://fpl-dashboard-production-xxxx.up.railway.app`).
4. Open it in a browser; you should see the app and be able to search by Team ID.

---

## Step 8: Custom domain — fpl.ballpwel.com

To serve the app at **fpl.ballpwel.com** (your domain ballpwel.com):

1. **Railway:** In your service → **Settings** → **Networking** → **Custom Domain** (or **Generate Domain** first if you haven’t).
2. **Add the subdomain:** Click **Add Custom Domain** and enter:
   ```text
   fpl.ballpwel.com
   ```
3. Railway will show the **CNAME target** you must point to (e.g. `something.up.railway.app` or `fpl-dashboard-production.railway.app`). Copy it.
4. **DNS (where ballpwel.com is managed):** Add a **CNAME** record:
   - **Name / Host:** `fpl` (or `fpl.ballpwel.com` depending on your DNS UI).
   - **Target / Value:** the hostname Railway gave you (e.g. `your-app.up.railway.app`).
   - **TTL:** 300 or 3600 is fine.
5. Wait for DNS to propagate (a few minutes up to 48 hours). Railway will issue SSL for fpl.ballpwel.com automatically.
6. Open **https://fpl.ballpwel.com** — your FPL dashboard should load.

**Summary for your DNS:**

| Type  | Name | Target (example)        |
|-------|------|-------------------------|
| CNAME | fpl  | your-app.up.railway.app |

Use the exact target shown in Railway’s Custom Domain settings.

---

## Summary checklist

| Step | Action |
|------|--------|
| 1 | Push code to GitHub (or your Git host). |
| 2 | Railway → New Project → Deploy from GitHub repo → select repo. |
| 3 | Build command: `npm run build` |
| 4 | Start command: `npm start` |
| 5 | (Optional) Set env vars. |
| 6 | Deploy and check logs. |
| 7 | Generate domain and open the URL. |
| 8 | Add custom domain **fpl.ballpwel.com** in Railway, then add CNAME `fpl` → Railway target in your DNS. |

---

## Step 9: Team name search (automatic)

Nothing to run. The server crawls the **Myanmar FPL country league** (league 167, ~13k managers) about 30 seconds after its first start and then **once a week**, saving the index to `search-index.json` in `DATA_DIR` (the `/data` volume), so it survives deploys. At the start of a new FPL season the index is wiped and rebuilt, because every team gets a new ID. Any other team people look up, or see in a league table, is added as well.

A crawl is ~260 FPL requests and takes 2–3 minutes. The logs show `Search index: crawled Myanmar league, N teams …` when it finishes.

---

## Notes

- **Single service:** One Railway service runs the Node server. It serves the built React app from `client/dist` and handles `/api` for FPL and images.
- **Search index:** Team name search uses `search-index.json` in `DATA_DIR` (filled automatically, see Step 9). The file is not in Git.
- **Restarts:** Each deploy rebuilds the app and restarts the server; in-memory caches (e.g. player photos) reset.

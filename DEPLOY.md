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

## Step 5: Environment variables (optional)

- **PORT:** Railway sets `PORT` automatically; the server already uses `process.env.PORT || 3001`.
- No API keys are required for the FPL proxy or TheSportsDB (free key is used in code).

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

## Notes

- **Single service:** One Railway service runs the Node server. It serves the built React app from `client/dist` and handles `/api` for FPL and images.
- **Search index:** Team name search is disabled in the UI. The server still has `/api/search`; if you re-enable the feature later, you can run the seed script (e.g. in a one-off job or locally) and persist `server/data/search-index.json` (e.g. via a volume if Railway supports it).
- **Restarts:** Each deploy rebuilds the app and restarts the server; in-memory caches (e.g. player photos) reset.

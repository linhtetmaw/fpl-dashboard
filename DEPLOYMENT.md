# FPL Dashboard – Step-by-step deployment guide

Your app is a **single deployable unit**: the Express server serves the built React app and all `/api` routes. No database or secrets are required for basic use.

---

## Before you deploy

### 1. Test the production build locally

From the project root:

```bash
# Install dependencies (if not already done)
npm run install:all

# Build the client (output: client/dist)
npm run build

# Run the server (serves client/dist + API)
npm start
```

Open **http://localhost:3001** (or the port shown). If the app and API work, you’re ready to deploy.

### 2. Put the project under Git (if not already)

```bash
git init
git add .
git commit -m "Initial commit"
```

Most platforms deploy from a Git repository (GitHub, GitLab, or their own Git).

---

## Option A: Deploy on Railway (recommended, free tier)

Railway runs Node apps and sets `PORT` for you.

### Step 1: Create a Railway account and project

1. Go to [railway.app](https://railway.app) and sign up (e.g. with GitHub).
2. Click **New Project**.
3. Choose **Deploy from GitHub repo** and connect your GitHub account. Select the `fpl-dashboard` repo (push your code to GitHub first if needed).

### Step 2: Configure the service

1. After the repo is connected, Railway may auto-detect the app. If it asks for **Root Directory**, leave it as **/** (repo root).
2. In the service **Settings** (or **Variables**), you usually don’t need any env vars; Railway sets `PORT` automatically.

### Step 3: Set build and start commands

In the service **Settings**:

- **Build Command:** `npm run build`  
  (This runs the root `build` script: installs deps and builds `client` into `client/dist`.)
- **Start Command:** `npm start`  
  (Runs `node server/index.js`; the server uses `PORT` and serves `client/dist`.)

If Railway uses a **Nixpacks** or **Dockerfile** flow, ensure:

- **Install:** `npm run install:all` or `npm install` in root and install in `server` and `client` as needed.
- **Build:** `npm run build`.
- **Start:** `npm start`.

### Step 4: Deploy and get the URL

1. Trigger a deploy (push to the connected branch or click **Deploy**).
2. In **Settings**, open **Networking** → **Generate Domain** to get a public URL like `https://your-app.up.railway.app`.
3. Open that URL; the dashboard and API should work (same origin, so `/api` works).

---

## Option B: Deploy on Render

### Step 1: Create a Render account and Web Service

1. Go to [render.com](https://render.com) and sign up.
2. **New** → **Web Service**.
3. Connect your Git provider and select the `fpl-dashboard` repository.

### Step 2: Configure the Web Service

- **Environment:** Node.
- **Build Command:** `npm run build`
- **Start Command:** `npm start`
- **Instance type:** Free (or paid if you prefer).

### Step 3: Deploy

1. Click **Create Web Service**. Render will install, build, and start the app.
2. It will assign a URL like `https://fpl-dashboard-xxxx.onrender.com`. Open it to verify.

---

## Option C: Deploy with Docker (VPS, Fly.io, etc.)

Use this if you want to run the app on any server or platform that supports Docker.

### Step 1: Add a Dockerfile

Create a file named `Dockerfile` in the project root (see the `Dockerfile` in this repo if present, or use the one below).

### Step 2: Build and run locally (optional)

```bash
docker build -t fpl-dashboard .
docker run -p 3001:3001 -e PORT=3001 fpl-dashboard
```

Then open http://localhost:3001.

### Step 3: Deploy to a host

- **Fly.io:** `fly launch`, then `fly deploy`.
- **VPS (e.g. DigitalOcean, Linode):** Copy the image or the repo onto the server, build the Docker image, and run it with `-p 80:3001` (or use a reverse proxy and keep `3001` internally).

---

## After deployment

- **HTTPS:** Railway and Render provide HTTPS by default.
- **CORS:** The server uses `cors()` and serves the frontend from the same origin, so same-origin `/api` requests work without extra CORS config.
- **Env:** Only `PORT` is needed; the server reads `process.env.PORT`. No API keys are required for the public FPL API.

If something doesn’t work, check the platform’s build and runtime logs: the **Build Command** must produce `client/dist`, and the **Start Command** must be `npm start` (or `node server/index.js`) so the server can serve both the static app and `/api`.

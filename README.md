# FPL Live Dashboard

A **React** dashboard for **Fantasy Premier League** that shows live points, your team, and league tables. No login—search by **Team ID** to view your squad and leagues.

## React app (recommended)

### Setup

1. Install dependencies for both server and client:

```bash
cd fpl-dashboard
npm run install:all
```

Or manually:

```bash
cd server && npm install
cd ../client && npm install
```

2. Start the **proxy server** (required for FPL API; avoids CORS):

```bash
npm run server
```

In another terminal, start the **React app**:

```bash
npm run client
```

3. Open [http://localhost:5173](http://localhost:5173).

### Usage

- **Search by Team ID** or **by Team name** (and optional Manager name). Team name search uses a server-side index so mobile users can find their team without knowing the ID.
- View **team summary**, **pitch view**, **player breakdown**, and **Leagues** (sort by Overall, Current GW, or Monthly).
- Use **Refresh data** to re-fetch from the FPL API.

### Name search index (recommended)

Name search looks up teams from a **server-side index**. To have many teams searchable:

1. **Seed the index once** (e.g. 100,000 teams from the Overall league):

```bash
cd server
node seed-search-index.js 2000
```

`2000` = 2000 pages (100,000 teams). Use a smaller number (e.g. `500`) for a quicker seed. The index is saved in `server/data/search-index.json` and loaded on server start.

2. **Auto-add on view**: Whenever someone loads a team by ID, that team is added to the index, so over time more teams become searchable even without re-running the seed.

3. **Stratified seed (for broader rank coverage)**  
   FPL has millions of managers; most ranks are in the millions, so seeding only from page 1 gives you the top ~100k. To also include teams from mid/lower ranks, run:

   ```bash
   node seed-search-index.js stratified
   ```

   This fetches from several page ranges (top 25k, then samples around ~500k, ~2.5M, and ~5M rank), so a mix of ranks is in the index. High page numbers may return empty if the league is smaller in early season.

4. **Can't find by name?**  
   In the app, when name search finds nothing, we show a **“Find your Team ID”** guide: users go to fantasy.premierleague.com, open their team, and copy the number from the URL (`…/entry/123456/…`). After they view their team once by ID, we add them to the index so name search works next time.

### Build for production

```bash
npm run build
```

Serves the built client from `client/dist`. In production, point your reverse proxy (e.g. Nginx) so `/api` goes to the Node proxy server.

### Deployment: pre-seed teams on your server

You can **download a large set of teams once** and keep them on the server so name search works without hitting the FPL API on every search.

**Requirements**

| Requirement | Notes |
|-------------|--------|
| **Node.js** | v18+ (for server and seed script). |
| **Build** | Run `npm run build` in `client/` and serve `client/dist` (or use your host’s static hosting). |
| **Server process** | Run the Node server (e.g. `node server/index.js` or `npm run server`) so `/api` (proxy, search, photos) is available. |
| **Persistent disk** | Keep `server/data/` so `search-index.json` is not lost on restart. |
| **RAM** | The server loads the full index at startup. ~100k teams ≈ 20–30 MB RAM; ~500k ≈ 100–150 MB. |

**Steps**

1. Deploy the app (build client, run Node server, reverse proxy to both).
2. On the server, run the seed script **once** (or on a schedule, e.g. weekly):

   ```bash
   cd server
   node seed-search-index.js 2000
   ```

   This fetches 2000 pages (100,000 teams) from the **top** of the Overall league. For coverage across ranks (including mid/lower), run `node seed-search-index.js stratified` instead to sample from several rank bands.
3. Restart the Node server (or start it if the seed ran first) so it loads the new index.
4. Ensure `server/data/` is on persistent storage (not an ephemeral filesystem) so the index survives restarts.

**Can you download “all” teams?**

- The FPL Overall league has **millions** of teams (10M+). Downloading every page would mean hundreds of thousands of API requests, a very large file, and likely rate limiting, so **“all” is not practical**.
- **Practical range:** 100k–500k teams (2000–10,000 pages). The seed script is capped at 5000 pages (250k teams) by default; you can change the cap in `server/seed-search-index.js` if you want more. Expect the seed to run for tens of minutes for 100k+ teams.
- Teams that anyone **views by ID** are added to the index automatically, so the searchable set grows over time even without re-running the seed.

---

## Streamlit app (legacy)

The project also includes a small Streamlit app for quick local use.

```bash
cd fpl-dashboard
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
streamlit run app.py
```

Open the URL shown (usually `http://localhost:8501`).

---

## Notes and limitations

- The app uses the public FPL API (`https://fantasy.premierleague.com/api/...`). If the API changes or rate-limits, updates may be needed.
- The React app talks to the API via the included Express proxy to avoid CORS.
- Avoid very frequent refreshing; the app uses caching to limit API calls.

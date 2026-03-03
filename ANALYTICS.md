# Analytics setup – Google Analytics 4 (GA4) and Google Tag Manager (GTM)

The app is set up to use **Google Analytics 4** when you provide a Measurement ID. Optionally you can use **Google Tag Manager** to manage GA4 and other tags.

---

## Option A: Google Analytics 4 (GA4) – recommended to start

### 1. Create a GA4 property

1. Go to [analytics.google.com](https://analytics.google.com) and sign in.
2. Click **Admin** (gear icon, bottom left).
3. In the **Property** column, click **Create Property**.
4. Enter a name (e.g. “FPL Dashboard”), set time zone and currency, then click **Next** → **Create**.

### 2. Get your Measurement ID

1. In **Admin** → **Property** column → **Data Streams**.
2. Click **Add stream** → **Web**.
3. Enter your site URL (e.g. `https://fpl.ballpwel.com`) and a stream name (e.g. “FPL Dashboard Web”).
4. Click **Create stream**.
5. On the stream page you’ll see **Measurement ID** (e.g. `G-XXXXXXXXXX`). Copy it.

### 3. Add the ID to your project

**Local / development**

Create a file `client/.env` (or add to it):

```env
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

Replace `G-XXXXXXXXXX` with your real Measurement ID.

**Production (Railway)**

1. In Railway: open your project → your service → **Variables**.
2. Click **New Variable**.
3. Name: `VITE_GA_MEASUREMENT_ID`  
   Value: your Measurement ID (e.g. `G-XXXXXXXXXX`).
4. Save. Redeploy so the new variable is used in the build.

### 4. Deploy and verify

- Rebuild and deploy (e.g. push to GitHub so Railway rebuilds).
- Open your live site and use it for a minute.
- In GA4 go to **Reports** → **Realtime**. You should see your visit.

The app already sends **page views** when users open the site or change routes (e.g. if you add more pages later). You can send custom events with `trackEvent('event_name', { param: 'value' })` from `./analytics`.

---

## Option B: Google Tag Manager (GTM) – manage GA4 and other tags

Use GTM when you want one place to add GA4, ads, or other scripts without changing code for each tag.

### 1. Create a GTM container

1. Go to [tagmanager.google.com](https://tagmanager.google.com) and sign in.
2. Click **Create Account** (or use an existing one).
3. Account name: e.g. “FPL Dashboard”.  
   Container name: e.g. “FPL Dashboard Web”.  
   Target platform: **Web**.
4. Click **Create**, accept the terms. You’ll see your **Container ID** (e.g. `GTM-XXXXXXX`). Copy it.

### 2. Add GA4 in GTM (optional but typical)

1. In GTM: **Tags** → **New** → **Tag Configuration** → **Google Analytics: GA4 Configuration**.
2. Enter your **Measurement ID** (same `G-XXXXXXXXXX` from Option A).
3. **Triggering**: choose **All Pages**.
4. Name the tag (e.g. “GA4 – Config”), save.
5. Click **Submit** (top right) to publish the container.

### 3. Add the GTM snippet to your site

You need the GTM code in your app. Two ways:

**A) GTM only (tags managed in GTM)**  
Add the GTM snippet to `client/index.html` and keep the existing GA4 code **disabled** (remove or don’t set `VITE_GA_MEASUREMENT_ID`), so GA runs only via GTM.

**B) Keep current GA4 code and add GTM**  
Add the GTM snippet for future tags; you can leave `VITE_GA_MEASUREMENT_ID` set so GA4 still works from the app, or turn it off and use only the GA4 tag in GTM.

If you want, I can give you the exact `<script>` blocks to paste into `client/index.html` for your Container ID (e.g. `GTM-XXXXXXX`).

### 4. Use your Container ID in production

- For **local**: you can hardcode the Container ID in `index.html` or read it from an env var (e.g. `VITE_GTM_ID=GTM-XXXXXXX` and inject it in the script).
- For **production**: set `VITE_GTM_ID` in Railway (or your host) so the same code works everywhere.

---

## Summary

| Goal                         | What to do |
|-----------------------------|------------|
| Track traffic with GA4      | Get Measurement ID → set `VITE_GA_MEASUREMENT_ID` in `client/.env` and in Railway. |
| Manage GA4 + other tags     | Create GTM container → add GA4 tag in GTM → add GTM snippet to the app (and optionally remove direct GA4 ID). |

The code in this repo is ready for GA4; set `VITE_GA_MEASUREMENT_ID` and deploy to start seeing traffic in GA4.

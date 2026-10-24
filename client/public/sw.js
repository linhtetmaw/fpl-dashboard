/**
 * FPL House service worker. Its job is to make the site installable ("Add to Home screen" / "Install app") and to
 * show a small offline page when a page is opened without a connection. It caches nothing: every page and API call
 * goes to the network as usual, so the app is never served stale.
 */
const OFFLINE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#13001a">
<title>Offline · FPL House</title>
<style>
  html, body { height: 100%; margin: 0; }
  body { display: flex; align-items: center; justify-content: center; background: #13001a; color: #f5f2f6;
         font-family: Inter, system-ui, -apple-system, sans-serif; text-align: center; padding: 24px; box-sizing: border-box; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  p { margin: 0 0 20px; color: #b9a8bd; font-size: 14px; line-height: 1.5; }
  button { background: #00ff85; color: #37003c; border: 0; border-radius: 10px; padding: 10px 18px;
           font-weight: 700; font-size: 14px; }
</style>
</head>
<body>
  <div>
    <h1>You're offline</h1>
    <p>FPL House needs an internet connection for live points and stats.</p>
    <button onclick="location.reload()">Try again</button>
  </div>
</body>
</html>`;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  // Only page loads: images, scripts and API calls are left to the browser.
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(
      () => new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    )
  );
});

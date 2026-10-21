/**
 * Per-page SEO for the single-page app: the server fills in each page's <title>, description, canonical URL and
 * Open Graph tags before sending index.html, so search engines and link previews (Telegram, Facebook, Viber – which
 * don't run JavaScript) see the right text for every page. Unknown paths get a real 404 + noindex.
 *
 * Page titles and descriptions live in client/src/seo-routes.json, shared with the app (browser tab titles).
 *
 * Env: CANONICAL_HOST – used for canonical and og:url links (falls back to the request host).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROUTES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'seo-routes.json'), 'utf8'));
const NOT_FOUND = { title: 'Page not found | FPL House', description: 'This page does not exist on FPL House.' };

const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function origin(req) {
  const host = process.env.CANONICAL_HOST?.trim() || req.get('host');
  return `https://${host}`;
}

/** "/player-stats/" → "/player-stats"; "/" stays "/". */
function cleanPath(p) {
  return p.length > 1 ? p.replace(/\/+$/, '') : p;
}

/** Fill one page's meta into the built index.html. Returns { status, html }. */
export function renderPage(templateHtml, req) {
  const p = cleanPath(req.path);
  const route = ROUTES[p];
  const meta = route ?? NOT_FOUND;
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const url = escapeHtml(`${origin(req)}${p}`);

  let html = templateHtml
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${description}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${title}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${description}$2`);

  // Canonical drops the query string, so personal links like /?team=123 aren't indexed as separate pages.
  const extra = route
    ? `<link rel="canonical" href="${url}" />\n    <meta property="og:url" content="${url}" />`
    : '<meta name="robots" content="noindex" />';
  html = html.replace('</head>', `    ${extra}\n  </head>`);
  return { status: route ? 200 : 404, html };
}

/** sitemap.xml listing every public page. */
export function sitemapXml(req) {
  const base = origin(req);
  const urls = Object.keys(ROUTES)
    .map((p) => `  <url><loc>${escapeHtml(base + p)}</loc><changefreq>${p === '/' || p === '/player-news' ? 'daily' : 'weekly'}</changefreq></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

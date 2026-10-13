/* Lemonade Inc. | sw.js
   Offline support. Network-first: when online you always get the latest version
   from Netlify; when offline the last copy you played is served from the cache.
   Bump CACHE when you add or rename files so old caches get cleared. */
const CACHE = 'lemonade-inc-v4';
const ASSETS = [
  './', 'index.html', 'css/style.css',
  'js/config.js', 'js/state.js', 'js/render.js', 'js/sim.js', 'js/ui.js', 'js/shell.js', 'js/main.js',
  'assets/title.webp', 'assets/opening.webp', 'assets/bg-mid.webp', 'assets/bg-wide.webp',
  'manifest.webmanifest', 'icons/favicon-32.png', 'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const cacheable = url.origin === location.origin || url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com');
  if (!cacheable) return;
  // cache:'no-cache' makes the browser check with the server every time, instead of reusing a copy it
  // decided was still fresh (that left edited files stale until a hard reload).
  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then(res => { if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});

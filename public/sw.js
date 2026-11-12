// Service worker: appen öppnas direkt (även utan nät) och visar senast hämtade data.
// Data (data/*.json) hämtas alltid från nätet först, skalet (html/js/css/bilder) från cachen först.
const CACHE = 'hcw-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) =>
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  ),
);

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const isData = url.pathname.includes('/data/');
  const key = isData ? url.origin + url.pathname : e.request;
  if (isData || e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(key, copy));
          return res;
        })
        .catch(() => caches.match(key).then((r) => r || caches.match('./'))),
    );
  } else {
    e.respondWith(
      caches.match(e.request).then(
        (hit) =>
          hit ||
          fetch(e.request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
            return res;
          }),
      ),
    );
  }
});

// Service worker: appen öppnas direkt (även utan nät) och visar senast hämtade data.
// Data (data/*.json) hämtas alltid från nätet först, skalet (html/js/css/bilder) från cachen först.
const CACHE = 'hcw-v2';

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

// ===== Push-notiser (mål, slutresultat, nedsläpp) =====
self.addEventListener('push', (e) => {
  let m = {};
  try {
    m = e.data ? e.data.json() : {};
  } catch {
    m = { title: 'HC Wettern', body: e.data ? e.data.text() : '' };
  }
  const base = self.registration.scope;
  e.waitUntil(
    self.registration.showNotification(m.title || 'HC Wettern', {
      body: m.body || '',
      tag: m.tag,
      renotify: m.kind === 'goal',
      icon: base + 'icons/icon-192.png',
      badge: base + 'icons/badge-96.png',
      vibrate: m.kind === 'goal' ? [200, 100, 200] : [100],
      data: { url: m.url || base },
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(self.registration.scope));
      if (open) return open.navigate(target).then((c) => (c || open).focus());
      return self.clients.openWindow(target);
    }),
  );
});

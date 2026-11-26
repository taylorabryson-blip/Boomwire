/**
 * Service worker: offline app shell + push notifications.
 * User data lives in IndexedDB and is never touched here.
 * Bump VERSION on every release so clients pick up new code.
 */
const VERSION = 'v0.6.0';
const CACHE = `hercules-shell-${VERSION}`;
const CORE = ['./', './index.html', './manifest.webmanifest', './assets/icons/icon-192.png', './assets/icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('hercules-shell-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Network-first, always revalidated with the server (cache: 'no-cache') so a
// phone never mixes old and new code files after an update. Offline → cache.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = e.request.mode === 'navigate'
        ? await fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' })
        : await fetch(new Request(e.request, { cache: 'no-cache' }));
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    } catch {
      return (await cache.match(e.request, { ignoreSearch: true })) || (await cache.match('./index.html'));
    }
  })());
});

self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data?.json() ?? {}; } catch { data = { title: 'Hercules', body: e.data?.text() ?? '' }; }
  e.waitUntil(self.registration.showNotification(data.title || 'Hercules', {
    body: data.body || '',
    tag: data.tag || undefined,
    icon: 'assets/icons/icon-192.png',
    badge: 'assets/icons/icon-192.png',
    data: { url: data.url || '#/home' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL(`./${e.notification.data?.url ?? '#/home'}`, self.registration.scope).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if ('focus' in w) { await w.navigate?.(target).catch(() => {}); return w.focus(); }
    }
    return self.clients.openWindow(target);
  })());
});
